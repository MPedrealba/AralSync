"""
Learner clustering using scikit-learn K-Means.

Provides K-Means++ clustering for learner grouping by subject performance.
Replaces the in-process JS K-Means in the principal subject-analysis route
with the real scikit-learn implementation (matches paper requirements).
"""

import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from typing import Optional


def cluster_learners(
    vectors: list[list[float]],
    k: int = 3,
    feature_names: Optional[list[str]] = None,
    learner_ids: Optional[list[str]] = None,
) -> dict:
    """
    Cluster learners using K-Means++.

    Args:
        vectors: List of feature vectors, one per learner.
                 Each vector is [subject1_avg, subject2_avg, ...]
        k: Number of clusters (default 3: High/On-Track/Needs Support)
        feature_names: Optional names for features (e.g., ["Math", "Science"])
        learner_ids: Optional learner IDs for mapping results

    Returns:
        dict with:
            - labels: cluster label per learner (0, 1, ..., k-1)
            - centroids: cluster center coordinates
            - inertia: within-cluster sum of squares (lower = tighter clusters)
            - learner_mapping: list of {learner_id, label, features} if IDs provided
            - cluster_sizes: count of learners per cluster
            - cluster_names: suggested names ordered by centroid mean (highest = High)
    """
    if not vectors or len(vectors) < k:
        return {
            "error": f"Not enough data points ({len(vectors)}) for k={k}",
            "labels": [],
            "centroids": [],
            "inertia": 0,
        }

    X = np.array(vectors, dtype=np.float64)

    # Standardize features for better clustering
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Fit K-Means with k-means++ initialization (matches paper spec)
    kmeans = KMeans(
        n_clusters=k,
        init="k-means++",
        n_init=10,
        max_iter=300,
        random_state=42,
    )
    labels = kmeans.fit_predict(X_scaled)

    # Inverse-transform centroids back to original scale
    centroids_original = scaler.inverse_transform(kmeans.cluster_centers_)

    # Assign cluster names based on centroid mean performance (higher = better)
    centroid_means = [float(np.mean(c)) for c in centroids_original]
    ranked = sorted(range(k), key=lambda i: centroid_means[i], reverse=True)

    name_pool = ["High Performing", "On Track", "Needs Support"]
    # Extend if k > 3
    while len(name_pool) < k:
        name_pool.append(f"Group {len(name_pool) + 1}")

    cluster_names_map = {}
    for rank_idx, cluster_idx in enumerate(ranked):
        cluster_names_map[cluster_idx] = name_pool[rank_idx]

    cluster_names = [cluster_names_map[i] for i in range(k)]

    # Build learner mapping
    learner_mapping = []
    if learner_ids:
        for i, lid in enumerate(learner_ids):
            learner_mapping.append({
                "learner_id": lid,
                "label": int(labels[i]),
                "cluster_name": cluster_names_map[int(labels[i])],
                "features": vectors[i] if feature_names is None else dict(zip(feature_names, vectors[i])),
            })

    # Cluster sizes
    cluster_sizes = [int(np.sum(labels == i)) for i in range(k)]

    return {
        "labels": labels.tolist(),
        "centroids": centroids_original.tolist(),
        "inertia": float(kmeans.inertia_),
        "learner_mapping": learner_mapping,
        "cluster_sizes": cluster_sizes,
        "cluster_names": cluster_names,
    }
