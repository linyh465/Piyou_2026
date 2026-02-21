import { useEffect } from 'react';
import useThemeStore from '../stores/themeStore';
import useBusStore from '../stores/busStore';
import { busRoutes, busStops } from '../data/transportData';
import { IconBus, IconMapPin, IconClock, IconRefresh } from '../components/Icons';

export default function Transport() {
    const isDarkMode = useThemeStore((s) => s.isDarkMode);

    // 從 busStore 取得共用資料 / Shared bus data from busStore
    const {
        arrivals, isLoading, error, updatedAt,
        manualCooldown, manualRefresh,
        startAutoRefresh, stopAutoRefresh,
    } = useBusStore();

    // 啟動/停止自動輪詢 / Start/stop auto polling
    useEffect(() => {
        startAutoRefresh();
        return () => stopAutoRefresh();
    }, [startAutoRefresh, stopAutoRefresh]);

    // 取得路線目的地描述 / Get destination description
    const getDestination = (routeName, direction) => {
        const route = busRoutes.find(r => r.name === routeName);
        if (!route) return '';
        const parts = route.description.split('-');
        if (parts.length < 2) return route.description;
        return direction === '去程' ? (parts[1] || '').trim() : (parts[0] || '').trim();
    };

    // 狀態顏色 / Status color based on arrival time
    const getStatusStyle = (arrival) => {
        const mins = arrival.estimatedMinutes;
        const code = arrival.stopStatusCode;
        if (code !== undefined && code !== null && code !== 0) return 'text-gray-400';
        if (mins === null || mins === undefined) return 'text-gray-400';
        if (mins <= 1) return 'text-red-500 font-bold animate-pulse';
        if (mins <= 5) return 'text-orange-500 font-semibold';
        return 'text-[color:var(--text-secondary)] font-medium';
    };

    return (
        <div className="page-container h-full flex flex-col overflow-hidden">
            {/* ── 頂部 Navbar ── */}
            <header className="page-header shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                        <IconBus size={24} />
                    </div>
                    <div>
                        <h1 className="page-title text-xl font-bold">公車動態</h1>
                        <p className="page-subtitle text-sm text-gray-500/80">
                            靜宜大學站點 即時到站
                            {updatedAt && (
                                <span className="ml-2 text-xs opacity-60">更新 {updatedAt}</span>
                            )}
                        </p>
                    </div>
                </div>
                <button
                    onClick={manualRefresh}
                    disabled={manualCooldown > 0}
                    className={`p-2 rounded-xl transition-colors flex items-center justify-center min-w-[40px] ${manualCooldown > 0
                            ? 'bg-black/5 dark:bg-white/5 text-gray-400 cursor-not-allowed'
                            : isDarkMode
                                ? 'hover:bg-white/5 text-gray-400 hover:text-white'
                                : 'hover:bg-black/5 text-gray-500 hover:text-black'
                        }`}
                    title={manualCooldown > 0 ? `請稍候 ${manualCooldown} 秒` : '重新整理'}
                >
                    {manualCooldown > 0 ? (
                        <span className="text-xs font-bold">{manualCooldown}s</span>
                    ) : (
                        <IconRefresh size={20} />
                    )}
                </button>
            </header>

            {/* ── 內容區塊 ── */}
            <div className="page-content flex-1 overflow-y-auto min-h-0 space-y-6 pb-6">

                {/* 錯誤提示 */}
                {error && arrivals.length === 0 && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        ⚠️ {error}
                    </div>
                )}

                {/* 即將進站列表 */}
                <section>
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <IconClock size={18} className="text-orange-500" />
                        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                            即將進站
                        </h2>
                    </div>

                    <div className="flex flex-col gap-3">
                        {isLoading && arrivals.length === 0 ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-20 rounded-xl bg-[color:var(--bg-subtle)] animate-pulse" />
                                ))}
                            </div>
                        ) : arrivals.length > 0 ? (
                            arrivals.map((arrival, idx) => (
                                <div key={idx} className="card p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                        {/* Route Badge */}
                                        <div className="w-14 h-14 rounded-xl bg-orange-500/10 flex flex-col items-center justify-center text-orange-500 shrink-0 border border-orange-500/20 shadow-sm">
                                            <span className="text-xl font-bold leading-tight tracking-tight">{arrival.routeName}</span>
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-[color:var(--text-primary)] text-base mb-1 truncate flex items-center gap-2">
                                                {arrival.stopName}
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[color:var(--text-secondary)] font-medium">
                                                    {arrival.direction}
                                                </span>
                                            </h3>
                                            <p className="text-xs text-[color:var(--text-secondary)] flex items-center gap-1.5 truncate">
                                                <IconMapPin size={12} className="opacity-70" />
                                                往 {getDestination(arrival.routeName, arrival.direction)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status / Time */}
                                    <div className={`flex flex-col items-end shrink-0 pl-4 ${getStatusStyle(arrival)}`}>
                                        <span className="text-xl font-bold whitespace-nowrap">
                                            {arrival.stopStatus || '-- 分'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-[color:var(--bg-subtle)] text-[color:var(--text-secondary)] gap-3 border border-dashed border-gray-300 dark:border-gray-700">
                                <IconBus size={32} className="opacity-40" />
                                <span className="text-sm">目前無即將到站之公車資訊</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* 關注站點區塊 */}
                <section className="pt-2">
                    <div className="flex items-center gap-2 mb-4 px-1">
                        <IconMapPin size={18} className="text-orange-500" />
                        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                            靜宜校內/周邊站點
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {busStops.map((stop) => (
                            <div
                                key={stop.id}
                                className="card p-3 flex items-center justify-between hover:bg-[color:var(--bg-subtle)] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[color:var(--text-secondary)]">
                                        <IconMapPin size={14} />
                                    </div>
                                    <span className="text-sm font-medium text-[color:var(--text-primary)]">
                                        {stop.name}
                                    </span>
                                </div>
                                <div className="text-[10px] font-medium px-2 py-1 rounded bg-black/5 dark:bg-white/10 text-[color:var(--text-secondary)]">
                                    查看路線
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
