/**
 * 統一 SVG 圖示庫 / Unified SVG Icon Library
 * 單色 stroke 風格，使用 currentColor 繼承文字顏色
 * Monochrome stroke style, inherits text color via currentColor.
 *
 * 所有圖示 / All icons: size=20, strokeWidth=1.75
 */

const defaultProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

const icon = (paths) =>
    function Icon({ size, className, ...props }) {
        return (
            <svg
                {...defaultProps}
                width={size || defaultProps.width}
                height={size || defaultProps.height}
                className={className}
                {...props}
            >
                {paths}
            </svg>
        );
    };

// ── 導航 / Navigation ──
export const IconHome = icon(
    <>
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </>
);

export const IconCalendar = icon(
    <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </>
);

export const IconCheckSquare = icon(
    <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 12l2 2 4-4" />
    </>
);

// ── 功能 / Feature ──
export const IconChartBar = icon(
    <>
        <rect x="3" y="12" width="4" height="9" rx="0.5" />
        <rect x="10" y="7" width="4" height="14" rx="0.5" />
        <rect x="17" y="3" width="4" height="18" rx="0.5" />
    </>
);

export const IconBus = icon(
    <>
        <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z" />
        <line x1="5" y1="9" x2="19" y2="9" />
        <circle cx="8" cy="15" r="1" fill="currentColor" />
        <circle cx="16" cy="15" r="1" fill="currentColor" />
        <path d="M8 18v2M16 18v2" />
    </>
);

export const IconMapPin = icon(
    <>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
    </>
);

export const IconClock = icon(
    <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </>
);

// ── 操作 / Actions ──
export const IconPlus = icon(
    <>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </>
);

export const IconEdit = icon(
    <>
        <path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </>
);

export const IconTrash = icon(
    <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
);

export const IconCheck = icon(
    <polyline points="20 6 9 17 4 12" />
);

export const IconCheckCircle = icon(
    <>
        <circle cx="12" cy="12" r="10" />
        <path d="M9 12l2 2 4-4" />
    </>
);

export const IconXCircle = icon(
    <>
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
    </>
);

export const IconDownload = icon(
    <>
        <path d="M12 3v12" />
        <polyline points="8 11 12 15 16 11" />
        <line x1="4" y1="21" x2="20" y2="21" />
    </>
);

export const IconArrowUp = icon(
    <>
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
    </>
);

export const IconRefresh = icon(
    <>
        <polyline points="1 4 1 10 7 10" />
        <polyline points="23 20 23 14 17 14" />
        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
        <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14" />
    </>
);

export const IconFilter = icon(
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
);

// ── 系統 / System ──
export const IconSun = icon(
    <>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </>
);

export const IconMoon = icon(
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
);

export const IconSettings = icon(
    <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
);

export const IconUser = icon(
    <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </>
);

export const IconBell = icon(
    <>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
);

export const IconLogOut = icon(
    <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </>
);

export const IconBook = icon(
    <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
);

export const IconFolder = icon(
    <>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </>
);

export const IconCloudLightning = icon(
    <>
        <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
        <polyline points="13 11 9 17 15 17 11 23" />
    </>
);

export const IconCloudOff = icon(
    <>
        <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </>
);

export const IconStar = icon(
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
);

export const IconChevronRight = icon(
    <polyline points="9 18 15 12 9 6" />
);

export const IconArrowLeft = icon(
    <>
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </>
);

export const IconSchool = icon(
    <>
        <path d="M2 10l10-6 10 6-10 6-10-6z" />
        <path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5" />
        <line x1="22" y1="10" x2="22" y2="16" />
    </>
);

export const IconDotsVertical = icon(
    <>
        <circle cx="12" cy="5" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="19" r="1" fill="currentColor" />
    </>
);

export const IconLibrary = icon(
    <>
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3" />
        <line x1="4" y1="10" x2="4" y2="21" />
        <line x1="20" y1="10" x2="20" y2="21" />
        <line x1="8" y1="14" x2="8" y2="17" />
        <line x1="12" y1="14" x2="12" y2="17" />
        <line x1="16" y1="14" x2="16" y2="17" />
    </>
);

export const IconEye = icon(
    <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </>
);

export const IconEyeOff = icon(
    <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </>
);

export const IconWowClass = icon(
    <>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
    </>
);

export const IconLink2 = icon(
    <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
);

export const IconMinus = icon(
    <line x1="5" y1="12" x2="19" y2="12" />
);
