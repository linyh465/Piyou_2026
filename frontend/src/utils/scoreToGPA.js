/**
 * GPA 4.3 對照表 / GPA 4.3 Scale Mapping
 * 前端共用，避免重複定義
 * Shared utility to avoid duplicated logic across components.
 */
export function scoreToGPA(score) {
    if (score >= 90) return 4.3;
    if (score >= 85) return 4.0;
    if (score >= 80) return 3.7;
    if (score >= 77) return 3.3;
    if (score >= 73) return 3.0;
    if (score >= 70) return 2.7;
    if (score >= 67) return 2.3;
    if (score >= 63) return 2.0;
    if (score >= 60) return 1.7;
    if (score >= 50) return 1.0;
    return 0.0;
}
