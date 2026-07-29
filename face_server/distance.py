# face_server/distance.py — Ladder distance estimation.
import numpy as np, cv2
from typing import Optional, List, Tuple
def point_in_polygon(px: float, py: float, poly: List[List[float]]) -> bool:
    n, inside, j = len(poly), False, len(poly) - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside
def bbox_in_roi_polygon(bbox, frame_w: int, frame_h: int, poly: Optional[List[List[float]]]) -> bool:
    if not poly: return True
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    return point_in_polygon((x1 + x2) / 2 / frame_w, (y1 + y2) / 2 / frame_h, poly)
def build_homography(pts_px: List[List[float]], pts_m: List[List[float]]) -> Optional[List[List[float]]]:
    if len(pts_px) < 4 or len(pts_m) < 4: return None
    H, _ = cv2.findHomography(np.array(pts_px, np.float32), np.array(pts_m, np.float32))
    return H.tolist() if H is not None else None
def depth_from_homography(H: List[List[float]], feet_px: Tuple[float, float]) -> Optional[float]:
    m = np.array(H, np.float64) @ np.array([feet_px[0], feet_px[1], 1.0], np.float64)
    if abs(m[2]) < 1e-9: return None
    return float(m[1] / m[2])
def build_person_calib(pts_px: List[dict], depths_m: List[float]) -> Optional[dict]:
    if len(pts_px) < 2 or len(depths_m) < 2: return None
    norm = [p["feet_y"] / max(1.0, p["height_px"]) for p in pts_px]
    a = (depths_m[1] - depths_m[0]) / (norm[1] - norm[0] + 1e-9)
    b = depths_m[0] - a * norm[0]
    return {"a": float(a), "b": float(b)}
def depth_from_person_calib(cal: dict, feet_y_px: float, height_px: float) -> Optional[float]:
    d = cal["a"] * (feet_y_px / max(1.0, height_px)) + cal["b"]
    return float(d) if d > 0 else None
def depth_pinhole(face_w_px: float, focal_px: float, real_face_m: float = 0.15) -> Optional[float]:
    if face_w_px <= 0 or focal_px <= 0: return None
    return (real_face_m * focal_px) / face_w_px
def estimate_depth_m(ctx: dict) -> Tuple[Optional[float], str]:
    mode = ctx.get("mode"); bbox = ctx["bbox"]
    x1, y1, x2, y2 = [float(v) for v in bbox[:4]]
    if mode in (None, "homography") and ctx.get("homography") and ctx.get("feet_px"):
        d = depth_from_homography(ctx["homography"], ctx["feet_px"])
        if d and d > 0: return d, "homography"
    if mode in (None, "person2") and ctx.get("person_calib"):
        d = depth_from_person_calib(ctx["person_calib"], ctx.get("feet_y_px", y2), ctx.get("height_px", (y2 - y1) * 3.0))
        if d and d > 0: return d, "person2"
    if ctx.get("focal_px"):
        d = depth_pinhole(max(1.0, x2 - x1), ctx["focal_px"])
        if d and d > 0: return d, "pinhole"
    return None, "none"
