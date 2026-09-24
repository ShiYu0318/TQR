"""
QR symbol structure + decodability certificate.

For a (version, EC level) we compute, per module:
  * func[r,c]  : module belongs to a function pattern / format / version info / dark module
                 (must never change: decoders need these to find and parse the symbol)
  * cw[r,c]    : index of the codeword (in the transmitted, interleaved stream) that the module's bit belongs to;
                 -1 = function module, -2 = remainder bit (carries no information -> free to flip)
  * blk[k]     : RS block of stream codeword k
  * cap[b]     : number of codeword ERRORS block b can correct = floor((ec_b - p) / 2)

Certificate: a projected image P decodes to the same payload as target T (for any standards-compliant decoder
that samples module centres correctly) if
   (1) P == T on every function module, and
   (2) for every block b, #distinct codewords in b containing >=1 wrong module <= cap[b].
"""
import numpy as np
import qrcode
import qrcode.util as qu
import qrcode.base as qb

EC = {"L": qrcode.constants.ERROR_CORRECT_L, "M": qrcode.constants.ERROR_CORRECT_M,
      "Q": qrcode.constants.ERROR_CORRECT_Q, "H": qrcode.constants.ERROR_CORRECT_H}
# misdecode-protection codewords p (ISO/IEC 18004 Table 9); zero elsewhere
P_TABLE = {(1, "L"): 3, (1, "M"): 2, (1, "Q"): 1, (1, "H"): 1, (2, "L"): 2, (3, "L"): 1}


def function_mask(version):
    n = 17 + 4 * version
    F = np.zeros((n, n), bool)
    for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):          # finders + separators
        F[max(r0 - 1, 0):r0 + 8, max(c0 - 1, 0):c0 + 8] = True
    F[6, :] = True; F[:, 6] = True                            # timing
    pos = qu.pattern_position(version)                       # alignment
    for r in pos:
        for c in pos:
            if F[r, c] and ((r < 9 and c < 9) or (r < 9 and c > n - 10) or (r > n - 10 and c < 9)):
                continue
            F[r - 2:r + 3, c - 2:c + 3] = True
    F[8, :9] = True; F[:9, 8] = True                          # format info
    F[8, n - 8:] = True; F[n - 8:, 8] = True
    F[n - 8, 8] = True                                        # dark module
    if version >= 7:                                          # version info
        F[:6, n - 11:n - 8] = True; F[n - 11:n - 8, :6] = True
    return F


def placement_order(F):
    """(row, col) of data modules in the order bits are placed (ISO zig-zag)."""
    n = F.shape[0]
    order = []
    col = n - 1
    upward = True
    while col > 0:
        if col == 6:
            col -= 1
        rows = range(n - 1, -1, -1) if upward else range(n)
        for r in rows:
            for c in (col, col - 1):
                if not F[r, c]:
                    order.append((r, c))
        upward = not upward
        col -= 2
    return order


def structure(version, level="H"):
    n = 17 + 4 * version
    F = function_mask(version)
    blocks = qb.rs_blocks(version, EC[level])
    ndata = [b.data_count for b in blocks]
    nec = [b.total_count - b.data_count for b in blocks]
    total = sum(b.total_count for b in blocks)
    # interleaved stream -> (block)
    blk = []
    for i in range(max(ndata)):
        for bi, d in enumerate(ndata):
            if i < d:
                blk.append(bi)
    for i in range(max(nec)):
        for bi, e in enumerate(nec):
            if i < e:
                blk.append(bi)
    blk = np.array(blk)
    assert len(blk) == total
    order = placement_order(F)
    cw = np.full((n, n), -1, int)
    for j, (r, c) in enumerate(order):
        cw[r, c] = j // 8 if j < total * 8 else -2
    p = P_TABLE.get((version, level), 0)
    cap = np.array([(e - p) // 2 for e in nec])
    return {"n": n, "version": version, "level": level, "func": F, "cw": cw, "blk": blk, "cap": cap,
            "ndata": ndata, "nec": nec, "total": total, "order": order}


def certificate(P, T, S):
    """P, T bool n x n (True = dark). Returns dict: ok, func_errors, block_errors, cap, wrong modules."""
    wrong = P != T
    func_err = int((wrong & S["func"]).sum())
    cws = S["cw"][wrong & (S["cw"] >= 0)]
    bad = np.unique(cws)
    per_block = np.bincount(S["blk"][bad], minlength=len(S["cap"])) if len(bad) else np.zeros(len(S["cap"]), int)
    ok = func_err == 0 and bool((per_block <= S["cap"]).all())
    return {"ok": ok, "func_errors": func_err, "block_errors": per_block, "cap": S["cap"],
            "wrong_modules": int(wrong.sum()), "bad_codewords": int(len(bad))}


def make_qr(data, level="H", version=None, mask=None):
    q = qrcode.QRCode(version=version, error_correction=EC[level], border=0, mask_pattern=mask)
    q.add_data(data)
    q.make(fit=version is None)
    return np.array(q.get_matrix(), bool), q.version, q


def validate(data="https://s.gd/aaa1", level="H", version=None):
    """Rebuild the symbol's data region from data_cache + our placement map and compare bit-for-bit."""
    M, v, q = make_qr(data, level, version)
    S = structure(v, level)
    stream = q.data_cache
    for mask in range(8):
        f = qu.mask_func(mask)
        R = M.copy()
        for j, (r, c) in enumerate(S["order"]):
            bit = ((stream[j // 8] >> (7 - j % 8)) & 1) if j < S["total"] * 8 else 0
            if f(r, c):
                bit ^= 1
            R[r, c] = bool(bit)
        if (R == M).all():
            return True, v, mask
    return False, v, None


if __name__ == "__main__":
    import random, string
    rng = random.Random(0)
    fails = 0
    for i in range(60):
        L = rng.choice([8, 16, 24, 40, 60, 90, 140])
        s = "https://" + "".join(rng.choice(string.ascii_letters + string.digits) for _ in range(L))
        lev = rng.choice("LMQH")
        ok, v, m = validate(s, lev)
        fails += not ok
    print("placement-map validation on 60 random symbols (versions/levels mixed): failures =", fails)
    for v in (1, 2, 3, 5, 7, 10):
        S = structure(v, "H")
        print(f"v{v}-H n={S['n']} blocks={len(S['cap'])} ec/block={S['nec']} correctable/block={list(S['cap'])} "
              f"func={int(S['func'].sum())} remainder={int((S['cw']==-2).sum())}")


def function_classes(version):
    """Label map of function modules: 0 data, 1 finder (7x7, incl. its inner white ring), 2 separator,
       3 timing, 4 alignment, 5 format/version info, 6 dark module."""
    n = 17 + 4 * version
    L = np.zeros((n, n), np.int8)
    for r0, c0 in ((0, 0), (0, n - 7), (n - 7, 0)):
        L[max(r0 - 1, 0):r0 + 8, max(c0 - 1, 0):c0 + 8] = 2
        L[r0:r0 + 7, c0:c0 + 7] = 1
    tim = np.zeros((n, n), bool); tim[6, 8:n - 8] = True; tim[8:n - 8, 6] = True
    L[tim] = 3
    for r in qu.pattern_position(version):
        for c in qu.pattern_position(version):
            if (r < 9 and c < 9) or (r < 9 and c > n - 10) or (r > n - 10 and c < 9):
                continue
            L[r - 2:r + 3, c - 2:c + 3] = 4
    fmt = np.zeros((n, n), bool)
    fmt[8, :9] = True; fmt[:9, 8] = True; fmt[8, n - 8:] = True; fmt[n - 8:, 8] = True
    if version >= 7:
        fmt[:6, n - 11:n - 8] = True; fmt[n - 11:n - 8, :6] = True
    L[fmt & (L != 1)] = 5
    L[n - 8, 8] = 6
    assert ((L > 0) == function_mask(version)).all()
    return L
