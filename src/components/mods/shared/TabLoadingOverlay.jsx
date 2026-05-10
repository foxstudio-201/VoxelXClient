/**
 * TabLoadingOverlay
 * Hiển thị overlay loading với animation logo từ SplashScreen
 * khi chuyển giữa các sub-tab để tránh flash nội dung cũ
 */
export default function TabLoadingOverlay({ visible }) {
  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center"
      style={{
        background: 'rgba(8,8,8,0.85)',
        backdropFilter: 'blur(4px)',
        animation: 'tab-overlay-in 0.15s ease-out',
      }}
    >
      <style>{`
        @keyframes tab-overlay-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Reuse splash logo keyframes — scaled down */
        @keyframes tab-tl {
          0%,100% { transform: translate(-10px,-10px) rotate(0deg)   scale(1);   opacity:.9; }
          15%      { transform: translate(-22px,-22px) rotate(0deg)   scale(1.1); opacity:1;  }
          50%      { transform: translate(-22px,-22px) rotate(360deg) scale(1.1); opacity:1;  }
          65%      { transform: translate(-10px,-10px) rotate(360deg) scale(1);   opacity:.9; }
        }
        @keyframes tab-tr {
          0%,100% { transform: translate( 10px,-10px) rotate(0deg)   scale(1);   opacity:.9; }
          15%      { transform: translate( 22px,-22px) rotate(0deg)   scale(1.1); opacity:1;  }
          50%      { transform: translate( 22px,-22px) rotate(360deg) scale(1.1); opacity:1;  }
          65%      { transform: translate( 10px,-10px) rotate(360deg) scale(1);   opacity:.9; }
        }
        @keyframes tab-bl {
          0%,100% { transform: translate(-10px, 10px) rotate(0deg)   scale(1);   opacity:.9; }
          15%      { transform: translate(-22px, 22px) rotate(0deg)   scale(1.1); opacity:1;  }
          50%      { transform: translate(-22px, 22px) rotate(360deg) scale(1.1); opacity:1;  }
          65%      { transform: translate(-10px, 10px) rotate(360deg) scale(1);   opacity:.9; }
        }
        @keyframes tab-br {
          0%,100% { transform: translate( 10px, 10px) rotate(0deg)   scale(1);   opacity:.9; }
          15%      { transform: translate( 22px, 22px) rotate(0deg)   scale(1.1); opacity:1;  }
          50%      { transform: translate( 22px, 22px) rotate(360deg) scale(1.1); opacity:1;  }
          65%      { transform: translate( 10px, 10px) rotate(360deg) scale(1);   opacity:.9; }
        }
        @keyframes tab-glow {
          0%,100% { opacity:0.2; transform:scale(1);   }
          15%      { opacity:0.7; transform:scale(1.6); }
          50%      { opacity:0.7; transform:scale(1.6); }
          65%      { opacity:0.2; transform:scale(1);   }
        }
      `}</style>

      {/* Logo animation — thu nhỏ so với splash */}
      <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
        {/* Glow */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ animation: 'tab-glow 3s ease-in-out infinite' }}
        >
          <div className="w-16 h-16 bg-green-500/25 rounded-full blur-2xl" />
        </div>

        {/* 4 blocks */}
        <div className="absolute rounded-lg" style={{
          width: 18, height: 18,
          background: '#4ade80',
          boxShadow: '0 0 10px #4ade8099',
          animation: 'tab-tl 3s ease-in-out 0s infinite',
        }} />
        <div className="absolute rounded-lg" style={{
          width: 18, height: 18,
          background: '#22c55e',
          boxShadow: '0 0 10px #22c55e99',
          animation: 'tab-tr 3s ease-in-out 0.06s infinite',
        }} />
        <div className="absolute rounded-lg" style={{
          width: 18, height: 18,
          background: '#16a34a',
          boxShadow: '0 0 10px #16a34a99',
          animation: 'tab-bl 3s ease-in-out 0.12s infinite',
        }} />
        <div className="absolute rounded-lg" style={{
          width: 18, height: 18,
          background: '#4ade80',
          boxShadow: '0 0 10px #4ade8099',
          animation: 'tab-br 3s ease-in-out 0.18s infinite',
        }} />
      </div>
    </div>
  )
}
