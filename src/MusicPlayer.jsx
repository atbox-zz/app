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
      buttons: [
        { text: "64方圓圖", filename: "./g.html", isEnglish: false, isGame: true },
        { text: "六十四卦速見表", filename: "./guaorder.html", isEnglish: false, isGame: true },
        { text: "公車路線", filename: "./indexv12.html", isEnglish: false, isGame: true },
        { text: "64卦狀態機", filename: "./yy.html", isEnglish: false, isGame: true },
        { text: "🤖AI示波器", filename: "./scope.html", isEnglish: false, isGame: true },
        { text: "🦋洛倫茲吸引子", filename: "./Lorenz_system_p.html", isEnglish: false, isGame: true },
        { text: "2D平面運動", filename: "./2DsimCanva.html", isEnglish: false, isGame: true },
        { text: "Neuron", filename: "./Neuron.html", isEnglish: false, isGame: true },
        { text: "CosmicNeural", filename: "./CosmicNeural.html", isEnglish: false, isGame: true },
        { text: "INNV閃網", filename: "./INNV_flash.html", isEnglish: false, isGame: true },
        { text: "Neural音樂", filename: "./Neuralmusic.html", isEnglish: false, isGame: true },
        { text: "🎲金錢卦", filename: "./gua1a.html", isEnglish: true, isGame: true },
        { text: "🌱生命系統", filename: "game of liveinlive中文2.html", isEnglish: false, isGame: true },
        { text: "🎯3d", filename: "./vertices3d.html", isEnglish: false, isGame: true },
        { text: "👁vis4d", filename: "./vis4d.html", isEnglish: false, isGame: true },
        { text: "👁vis4d0", filename: "./vis4d0.html", isEnglish: false, isGame: true },
        { text: "超立方體", filename: "./tesseract.html", isEnglish: false, isGame: true },
        { text: "✨vis6e", filename: "vis6e.html", isEnglish: false, isGame: true },
        { text: "查八字", filename: "8w0b.html", isEnglish: false, isGame: true },
        { text: "大運流年", filename: "8w2.html", isEnglish: false, isGame: true },
        { text: "QuantumDNA", filename: "QuantumDNA.html", isEnglish: false, isGame: true },
		    { text: "勞保退休萬事通", filename: "retirement_calc.html", isEnglish: false, isGame: true },
		    { text: "115年年曆DIY", filename: "2026_Calendar.html", isEnglish: false, isGame: true },
		    { text: "115年雙月曆DIY", filename: "2026_Calendar6.html", isEnglish: false, isGame: true },
		    { text: "115年12月曆DIY", filename: "2026_Calendar12.html", isEnglish: false, isGame: true },
        { text: "人臉辨識", filename: "face-api.html", isEnglish: false, isGame: true },
        { text: "生物行為 Boids算法", filename: "boids_audio.html", isEnglish: false, isGame: true },
		    { text: "矽基生命探索", filename: "silicon/siliconindex.html", isEnglish: false, isGame: true },
		    { text: "投胎模擬器", filename: "ai_studio_rebirth.html", isEnglish: false, isGame: true },
        { text: "量子隧穿說明", filename: "量子隧穿效應.html", isEnglish: false, isGame: true },
		    { text: "量子隧穿動畫", filename: "量子隧穿效應1.html", isEnglish: false, isGame: true },
		    { text: "量子隧穿動畫1", filename: "量子隧穿效應claude4.html", isEnglish: false, isGame: true },
      ]
    },
    {
      buttons: [
        { text: "拉霸機", filename: "slotmachine.html", isEnglish: false, isGame: true },
        { text: "井字棋", filename: "./xx.html", isEnglish: false, isGame: true },
        { text: "🐍", filename: "./snake1.html", isEnglish: false, isGame: true },
        { text: "🎮魔術方塊", filename: "./cude6c.html", isEnglish: true, isGame: true },
        { text: "八宮卦方立體", filename: "./zz.html", isEnglish: false, isGame: true },
        { text: "🔺64D", filename: "./vertices64d1.html", isEnglish: false, isGame: true },
        { text: "🔺64D2", filename: "./vis_mobile.html", isEnglish: false, isGame: true },
        { text: "DS OR單形法", filename: "./simplex.html", isEnglish: false, isGame: true },
        { text: "Grok OR單形法", filename: "./simplex1.html", isEnglish: false, isGame: true },
        { text: "4維立方體", filename: "./Hypercube.html", isEnglish: false, isGame: true },
        { text: "【命中注定】", filename: "love_story.html", isEnglish: false, isGame: true },
        { text: "台指期", filename: "taiwan-future-arbitrage/taiwan-futures-arbitrage-final/index.html", isEnglish: false, isGame: true },
        { text: "AI訓練", filename: "interactiveai/index.html", isEnglish: false, isGame: true },
        { text: "明明動了", filename: "git-viz.html", isEnglish: false, isGame: true },
        { text: "管線", filename: "pipe.html", isEnglish: false, isGame: true },
        { text: "AI-tools", filename: "ai-tool.html", isEnglish: false, isGame: true },
        { text: "pop方程式", filename: "pop_music2.html", isEnglish: false, isGame: true },
        { text: "文字DNA編解碼", filename: "DNA_Cyper1.html", isEnglish: false, isGame: true },
        { text: "ClawOS", filename: "RELEASE_MANIFEST.html", isEnglish: false, isGame: true },
      ]

    },
    {
      buttons: [
        { text: "你老師咧", filename: "https://atbox-zz.github.io/app/你老師咧.mp3", isEnglish: false },
        { text: "參加喪禮會想死", filename: "https://atbox-zz.github.io/app/參加喪禮會想死.mp3", isEnglish: false },
        { text: "吃賽啦", filename: "https://atbox-zz.github.io/app/吃屎啦.mp3", isEnglish: false },
        { text: "哭北哦", filename: "https://atbox-zz.github.io/app/哭北.mp3", isEnglish: false },
        { text: "我信你個鬼", filename: "https://atbox-zz.github.io/app/我信你個鬼.mp3", isEnglish: false },
        { text: "不可能的任務", filename: "https://atbox-zz.github.io/app/不可能的任務.mp3", isEnglish: false },
        { text: "你不要過來啊!", filename: "https://atbox-zz.github.io/app/你不要過來啊.mp3", isEnglish: false },
        { text: "五姑媽", filename: "https://atbox-zz.github.io/app/五姑媽.mp3", isEnglish: false },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
        { text: "", filename: "", isEnglish: false, isGame: true },
      ]
    },
    {
      buttons: [
        { text: "小明劍魔 回答我!", filename: "https://atbox-zz.github.io/app/answerme.mp3", isEnglish: false },
        { text: "LOOK\nIN\nMY EYES", filename: "./Lookmyeyes.mp3", isEnglish: true },
        { text: "TELL\nME\nWHY?", filename: "./Tellmewhy.mp3", isEnglish: true },
        { text: "啊能能!", filename: "./啊能能.mp3", isEnglish: false },
      ]
    }
  ];

  const playMusic = (filename, buttonIndex, isGame = false, isDisabled = false, isEmpty = false) => {
    // 如果按鈕被禁用或為空，直接返回
    if (isDisabled || isEmpty) {
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
  }, [audioPages.length, currentPage]);

  const buttonStyle = {
    background: 'linear-gradient(145deg, #f5f5dc, #e6e6d4)',
    color: '#2c3e50',
    border: '4px solid #8fbc8f',
    padding: '4vw 3vw',
    fontSize: '8vw',
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
    fontSize: '3.5vw',
  };

  const englishTextStyle = {
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
    fontSize: '3.2vw',
    lineHeight: '1.2',
  };

  const pageColors = [
    ['#fff0e6', '#ffe0cc', '#f0e6ff', '#e0ccff', '#ffe6f0', '#ffccdd', '#e6fffa', '#ccfff7', '#f0f8ff', '#e6f3ff', '#fff8dc', '#f5f5dc', '#ffefd5', '#ffd4aa', '#e6f7ff', '#cceeff'], // 童話故事 (4x4)
    ['#ffe6f0', '#ffccdd', '#e6fffa', '#ccfff7', '#fff0e6', '#ffe0cc', '#f0e6ff', '#e0ccff', '#f0f8ff', '#e6f3ff', '#fff8dc', '#f5f5dc', '#ffefd5', '#ffd4aa', '#e6f7ff', '#cceeff'], // 搞笑語音 (4x4)
    ['#f0f8ff', '#e6f3ff', '#fff8dc', '#f5f5dc', '#ffefd5', '#ffd4aa', '#e6f7ff', '#cceeff', '#ffe6f0', '#ffccdd', '#e6fffa', '#ccfff7', '#fff0e6', '#ffe0cc', '#f0e6ff', '#e0ccff'], // 遊戲專區 (4x4)
    ['#e6f3ff', '#cce7ff', '#e6ffe6', '#ccffcc'], // 小明劍魔區 (2x2)
  ];

  // 根據當前頁面和按鈕數量決定佈局
  const getGridLayout = (currentPageIndex) => {
// 移除未使用的變數
    if (currentPageIndex === 3) {
      // 小明劍魔區保持2x2佈局
      return {
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '3vw',
        width: '85vw',
        padding: '4vw',
      };
    } else {
      // 其他區都使用4x4佈局
      return {
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(8, 1fr)',
        gap: '2vw',
        width: '80vw',
        padding: '3vw',
        maxHeight: '90vh',
        overflowY: 'auto',
      };
    }
  };

  // 根據按鈕數量調整按鈕樣式
  const getButtonStyle = (currentPageIndex, index) => {
    const colors = pageColors[currentPageIndex];
    const colorIndex = index < colors.length ? index : index % colors.length;
    
    let baseStyle = { ...buttonStyle };
    
    if (currentPageIndex === 3) {
      // 小明劍魔區保持原尺寸
      baseStyle = {
        ...buttonStyle,
        minWidth: '35vw',
        minHeight: '15vh',
      };
    } else {
      // 其他區使用4x4小按鈕
      baseStyle = {
        ...buttonStyle,
        padding: '2vw 1vw',
        fontSize: '5.5vw',
        minHeight: '10vh',
        minWidth: '18vw',
      };
    }
    
    return {
      ...baseStyle,
      background: `linear-gradient(145deg, ${colors[colorIndex]}, ${colors[colorIndex].replace('e6', 'cc')})`,
      ...(currentButton === index ? pressedStyle : {}),
    };
  };

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
        fontSize: '2.5vw',
        fontWeight: 'bold',
        marginBottom: '0vh',
        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        paddingTop: '0vh',
      }}>
        {audioPages[currentPage].title}
      </div>

      {/* 頁面指示器 */}
      <div style={{
        display: 'flex',
        gap: '3vw',
        marginBottom: '1vh',
      }}>
        {audioPages.map((_, index) => (
          <div
            key={index}
            style={{
              width: '4vw',
              height: '4vw',
              borderRadius: '50%',
              background: index === currentPage ? '#fff' : 'rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '12px',
              minHeight: '12px',
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
          ...getGridLayout(currentPage),
          background: 'linear-gradient(145deg, #556b23, #6b8e23)',
          borderRadius: '4vw',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
          border: '0.8vw solid #8fbc87',
          maxWidth: '95vw',
          // 添加滾動條樣式
          scrollbarWidth: 'thin',
          scrollbarColor: '#8fbc8f #556b23',
        }}
        // 為遊戲專區添加 CSS 滾動條樣式
        className={audioPages[currentPage].buttons.length > 4 ? 'game-section' : ''}
      >
        {audioPages[currentPage].buttons.map((button, index) => (
          <button
            key={index}
            style={getButtonStyle(currentPage, index)}
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
            left: '2vw',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '4vw',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            userSelect: 'none',
            webkitUserSelect: 'none',
            webkitTouchCallout: 'none',
            transition: 'color 0.3s ease',
            zIndex: 10,
            padding: '2vw',
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
            right: '2vw',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '4vw',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            userSelect: 'none',
            webkitUserSelect: 'none',
            webkitTouchCallout: 'none',
            transition: 'color 0.3s ease',
            zIndex: 10,
            padding: '2vw',
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