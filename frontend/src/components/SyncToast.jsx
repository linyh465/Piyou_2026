/**
 * 同步完成 Toast / Sync Completion Toast
 * 當任務或共享資料同步成功時，底部短暫顯示提示。
 */
import useSyncToastStore from '../stores/syncToastStore';

export default function SyncToast() {
    const { visible, message } = useSyncToastStore();

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 9000,
                background: 'var(--color-success, #10b981)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                padding: '8px 18px',
                borderRadius: '999px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                pointerEvents: 'none',
                animation: 'syncToastIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                whiteSpace: 'nowrap',
            }}
        >
            <span style={{ fontSize: '15px' }}>✓</span>
            {message}
            <style>{`
                @keyframes syncToastIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(12px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>
        </div>
    );
}
