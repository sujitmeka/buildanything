"""TF-IDF cosine similarity across agent prompts. Flags redundant agents."""
from __future__ import annotations
import argparse
from common import iter_markdown_files, read, rel

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    raise SystemExit("pip install scikit-learn")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.6)
    ap.add_argument("--dir", default="agents")
    args = ap.parse_args()

    files, docs = [], []
    for p in iter_markdown_files():
        if not rel(p).startswith(args.dir + "/"):
            continue
        _, body = read(p)
        files.append(rel(p))
        docs.append(body)

    if len(docs) < 2:
        print("Not enough documents.")
        return

    vec = TfidfVectorizer(stop_words="english", max_features=5000, ngram_range=(1, 2))
    mat = vec.fit_transform(docs)
    sim = cosine_similarity(mat)

    pairs = []
    for i in range(len(files)):
        for j in range(i + 1, len(files)):
            if sim[i][j] >= args.threshold:
                pairs.append((sim[i][j], files[i], files[j]))
    pairs.sort(reverse=True)

    print(f"Scanned {len(files)} files in {args.dir}/. Threshold: {args.threshold}")
    print(f"Similar pairs: {len(pairs)}\n")
    for s, a, b in pairs:
        print(f"  {s:.2f}  {a}  <->  {b}")


if __name__ == "__main__":
    main()
