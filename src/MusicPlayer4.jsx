import React, { useState, useRef, useEffect } from 'react';

// Custom swipe handler (mimicking react-swipeable functionality)
const useSwipeable = (handlers) => {
  const ref = useRef(null);
  
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      const deltaTime = Date.now() - startTime;
      
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);
      
      // Only trigger if horizontal swipe is dominant and meets thresholds
      if (absDeltaX > absDeltaY && absDeltaX > 50 && deltaTime < 500) {
        const event = {
          deltaX,
          deltaY,
          absX: absDeltaX,
          absY: absDeltaY,
          velocity: absDeltaX / deltaTime
        };
        
        if (deltaX > 0) {
          handlers.onSwipedRight?.(event);
        } else {
          handlers.onSwipedLeft?.(event);
        }
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlers]);

  return ref;
};

const MusicPlayer = () => {
  const [currentButton, setCurrentButton] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);

  // 設置 viewport 和防止縮放
  useEffect(() => {
    // 設置 viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'viewport';
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(meta);
    }

    // 防止頁面滾動
    const preventScroll = (e) => {
      e.preventDefault();
    };

    // 防止雙擊縮放
    const preventZoom = (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // 防止長按選擇
    const preventSelect = (e) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('touchstart', preventZoom, { passive: false });
    document.addEventListener('selectstart', preventSelect);
    document.addEventListener('contextmenu', preventSelect);

    // 設置 body 樣式
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100vw';
    document.body.style.height = '100vh';
    document.body.style.userSelect = 'none';
    document.body.style.webkitTouchCallout = 'none';

    return () => {
      document.removeEventListener('touchmove', preventScroll);
      document.removeEventListener('touchstart', preventZoom);
      document.removeEventListener('selectstart', preventSelect);
      document.removeEventListener('contextmenu', preventSelect);
    };
  }, []);

  // 音頻數據配置
  const audioPages = [
    {
      title: "小明劍魔回答我！",
      buttons: [
        { text: "回答我!", filename: "https://atbox-zz.github.io/app/answerme.mp3", isEnglish: false },
        { text: "LOOK\nIN\nMY EYES", filename: "https://atbox-zz.github.io/app/Lookmyeyes.mp3", isEnglish: true },
        { text: "TELL\nME\nWHY?", filename: "./Tellmewhy.mp3", isEnglish: true },
        { text: "啊能能!", filename: "./啊能能.mp3", isEnglish: false },
      ]
    },
    {
      title: "童話故事柯佳嬿金句",
      buttons: [
        { text: "你老師咧", filename: "https://atbox-zz.github.io/app/你老師咧.mp3", isEnglish: false },
        { text: "參加喪禮會想死", filename: "https://atbox-zz.github.io/app/參加喪禮會想死.mp3", isEnglish: false },
        { text: "吃賽啦", filename: "https://atbox-zz.github.io/app/吃屎啦.mp3", isEnglish: false },
        { text: "哭北哦", filename: "https://atbox-zz.github.io/app/哭北.mp3", isEnglish: false },
      ]
    },
    {
      title: "搞笑語音動感節拍",
      buttons: [
        { text: "我信你個鬼", filename: "https://atbox-zz.github.io/app/我信你個鬼.mp3", isEnglish: false },
        { text: "不可能的任務", filename: "https://atbox-zz.github.io/app/不可能的任務.mp3", isEnglish: false },
        { text: "你不要過來啊!", filename: "https://atbox-zz.github.io/app/你不要過來啊.mp3", isEnglish: false },
        { text: "五姑媽", filename: "https://atbox-zz.github.io/app/五姑媽.mp3", isEnglish: false },
      ]
    },
    {
      title: "遊戲專區1",
      buttons: [
        { text: "🐍\n貪食蛇\n遊戲", filename: "./snake1.html", isEnglish: false, isGame: true },
        { text: "🎮\nGAME\n魔術方塊", filename: "./cude6b.html", isEnglish: true, isGame: true },
        { text: "🎮\nGAME\n增刪卜易金錢卦", filename: "./gua1a.html", isEnglish: true, isGame: true },
        { text: "🎯\n多物種演化\n生態系統\n", filename: "game of liveinlive中文2.html", isEnglish: false, isGame: true },
      ]
    },
    {
      title: "遊戲專區2",
      buttons: [
        { text: "🐍\nvertices64d1", filename: "./vertices64d1.html", isEnglish: false, isGame: true },
        { text: "3d", filename: "./vertices3d.html", isEnglish: false, isGame: true },
        { text: "vis4d", filename: "./vis4d.html", isEnglish: false, isGame: true },
        { text: "🎯\nvis6e\n", filename: "vis6e.html", isEnglish: false, isGame: true },
      ]
    }
  ];

  const playMusic = (filename, buttonIndex, isGame = false, isDisabled = false) => {
    // 如果按鈕被禁用，直接返回
    if (isDisabled) {
      return;
    }

    // 移除之前按鈕的效果
    if (currentButton !== null) {
      setCurrentButton(null);
    }
    
    // 停止當前音樂
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // 添加按下效果
    setCurrentButton(buttonIndex);
    
    // 如果是遊戲，打開新窗口
    if (isGame) {
      window.open(filename, '_blank');
      // 500ms後移除按下效果
      setTimeout(() => {
        setCurrentButton(null);
      }, 500);
      return;
    }
    
    // 播放音樂
    const audio = new Audio(filename);
    setCurrentAudio(audio);
    
    audio.play().catch(error => {
      console.log('Audio playback failed:', error);
    });
    
    // 音樂結束後移除效果
    audio.addEventListener('ended', () => {
      setCurrentButton(null);
    });
    
    // 500ms後移除按下效果（如果音樂還在播放）
    setTimeout(() => {
      if (audio && !audio.paused) {
        setCurrentButton(null);
      }
    }, 500);
  };

  // 使用自定義 swipeable hook
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentPage < audioPages.length - 1) {
        setCurrentPage(currentPage + 1);
      }
    },
    onSwipedRight: () => {
      if (currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    },
    trackMouse: true, // 支持滑鼠拖拽
    preventDefaultTouchmoveEvent: false,
    delta: 50 // 最小滑動距離
  });

  // 鍵盤事件處理
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      } else if (e.key === 'ArrowRight' && currentPage < audioPages.length - 1) {
        setCurrentPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

  const buttonStyle = {
    background: 'linear-gradient(145deg, #f5f5dc, #e6e6d4)',
    color: '#2c3e50',
    border: '4px solid #8fbc8f',
    padding: '4vw 3vw',
    fontSize: '4vw',
    fontWeight: 'bold',
    borderRadius: '3vw',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    minWidth: '20vw',
    minHeight: '15vh',
    position: 'relative',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
    webkitUserSelect: 'none',
    webkitTouchCallout: 'none',
  };

  const pressedStyle = {
    ...buttonStyle,
    transform: 'translateY(2px)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.1), 0 0 20px #00ff00, inset 0 0 20px rgba(0, 255, 0, 0.3)',
    background: 'linear-gradient(145deg, #e6ffe6, #ccffcc)',
  };

  const chineseTextStyle = {
    textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)',
    fontSize: '4vw',
  };

  const englishTextStyle = {
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
    fontSize: '3vw',
    lineHeight: '1.2',
  };

  const pageColors = [
    ['#e6f3ff', '#cce7ff', '#e6ffe6', '#ccffcc'], // 經典語音
    ['#fff0e6', '#ffe0cc', '#f0e6ff', '#e0ccff'], // 搞笑語音
    ['#ffe6f0', '#ffccdd', '#e6fffa', '#ccfff7'], // 動感節拍
    ['#f0f8ff', '#e6f3ff', '#fff8dc', '#f5f5dc'], // 遊戲專區
    ['#f0f8ff', '#e6f3ff', '#fff8dc', '#f5f5dc'], // 遊戲專區
  ];

  return (
    <div
      ref={swipeHandlers}
      style={{
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        background: '#100000',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        userSelect: 'none',
        webkitUserSelect: 'none',
        webkitTouchCallout: 'none',
      }}
    >
      {/* 標題 */}
      <div style={{
        color: '#fff',
        fontSize: '6vw',
        fontWeight: 'bold',
        marginBottom: '3vh',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
      }}>
        {audioPages[currentPage].title}
      </div>

      {/* 頁面指示器 */}
      <div style={{
        display: 'flex',
        gap: '8vw',
        marginBottom: '5vh',
      }}>
        {audioPages.map((_, index) => (
          <div
            key={index}
            style={{
              width: '5vw',
              height: '5vw',
              borderRadius: '50%',
              background: index === currentPage ? '#fff' : 'rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onClick={() => setCurrentPage(index)}
            onTouchStart={(e) => e.stopPropagation()}
          />
        ))}
      </div>

      {/* 音樂播放器容器 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2vw',
          padding: '5vw',
          background: 'linear-gradient(145deg, #556b23, #6b8e23)',
          borderRadius: '5vw',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          border: '1vw solid #8fbc87',
          width: '85vw',
          maxWidth: '85vw',
        }}
      >
        {audioPages[currentPage].buttons.map((button, index) => (
          <button
            key={index}
            style={{
              ...buttonStyle,
              background: `linear-gradient(145deg, ${pageColors[currentPage][index]}, ${pageColors[currentPage][index].replace('e6', 'cc')})`,
              ...(currentButton === index ? pressedStyle : {}),
              ...(button.isDisabled ? {
                opacity: 0.5,
                cursor: 'not-allowed',
                filter: 'grayscale(0.3)'
              } : {}),
            }}
            onClick={() => playMusic(button.filename, index, button.isGame, button.isDisabled)}
            onTouchStart={(e) => {
              e.stopPropagation();
              playMusic(button.filename, index, button.isGame, button.isDisabled);
            }}
            disabled={button.isDisabled}
          >
            <span style={button.isEnglish ? englishTextStyle : chineseTextStyle}>
              {button.text.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  {i < button.text.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </span>
          </button>
        ))}
      </div>

      {/* 左右箭頭 */}
      {currentPage > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '3vw',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '8vw',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            userSelect: 'none',
            webkitUserSelect: 'none',
            webkitTouchCallout: 'none',
            transition: 'color 0.3s ease',
          }}
          onClick={() => setCurrentPage(currentPage - 1)}
          onTouchStart={(e) => {
            e.stopPropagation();
            setCurrentPage(currentPage - 1);
          }}
        >
          ◀
        </div>
      )}

      {currentPage < audioPages.length - 1 && (
        <div
          style={{
            position: 'absolute',
            right: '3vw',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '8vw',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            userSelect: 'none',
            webkitUserSelect: 'none',
            webkitTouchCallout: 'none',
            transition: 'color 0.3s ease',
          }}
          onClick={() => setCurrentPage(currentPage + 1)}
          onTouchStart={(e) => {
            e.stopPropagation();
            setCurrentPage(currentPage + 1);
          }}
        >
          ▶
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;