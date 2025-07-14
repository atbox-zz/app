import React, { useState, useRef, useEffect } from 'react';

const MusicPlayer = () => {
  const [currentButton, setCurrentButton] = useState(null);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const containerRef = useRef(null);

  // 音頻數據配置
  const audioPages = [
    {
      title: "小明劍魔回答我！",
      buttons: [
        { text: "回答我!", filename: "/回答我.mp3", isEnglish: false },
        { text: "LOOK\nIN\nMY EYES", filename: "/Lookmyeyes.mp3", isEnglish: true },
        { text: "TELL\nME\nWHY?", filename: "/Tellmewhy.mp3", isEnglish: true },
        { text: "啊能能!", filename: "/啊能能.mp3", isEnglish: false },
      ]
    },
    {
      title: "童話故事柯佳嬿金句",
      buttons: [
        { text: "你老師咧", filename: "/你老師咧.mp3", isEnglish: false },
        { text: "參加喪禮會想死", filename: "/參加喪禮會想死.mp3", isEnglish: true },
        { text: "吃賽啦", filename: "/吃屎啦.mp3", isEnglish: false },
        { text: "哭北哦", filename: "/哭北.mp3", isEnglish: false },
      ]
    },
    {
      title: "搞笑語音動感節拍",
      buttons: [
        { text: "我信你個鬼", filename: "/我信你個鬼.mp3", isEnglish: false },
        { text: "不可能的任務", filename: "/不可能的任務.mp3", isEnglish: false },
        { text: "你不要過來啊!", filename: "/你不要過來啊.mp3", isEnglish: false },
        { text: "五姑媽", filename: "/五姑媽.mp3", isEnglish: false },
      ]
    }
  ];

  const playMusic = (filename, buttonIndex) => {
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

  // 觸摸事件處理
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentPage < audioPages.length - 1) {
      setCurrentPage(currentPage + 1);
    }
    if (isRightSwipe && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

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
    padding: '20px 12px',
    fontSize: '14px',
    fontWeight: 'bold',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    minWidth: '100px',
    minHeight: '70px',
    position: 'relative',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const pressedStyle = {
    ...buttonStyle,
    transform: 'translateY(2px)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3), inset 0 -2px 4px rgba(0, 0, 0, 0.1), 0 0 20px #00ff00, inset 0 0 20px rgba(0, 255, 0, 0.3)',
    background: 'linear-gradient(145deg, #e6ffe6, #ccffcc)',
  };

  const hoverStyle = {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  };

  const chineseTextStyle = {
    textShadow: '2px 2px 4px rgba(255, 255, 255, 0.8)',
    fontSize: '16px',
  };

  const englishTextStyle = {
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)',
    fontSize: '12px',
    lineHeight: '1.2',
  };

  const pageColors = [
    ['#e6f3ff', '#cce7ff', '#e6ffe6', '#ccffcc'], // 經典語音
    ['#fff0e6', '#ffe0cc', '#f0e6ff', '#e0ccff'], // 搞笑語音
    ['#ffe6f0', '#ffccdd', '#e6fffa', '#ccfff7'], // 動感節拍
  ];

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      margin: 0,
      background: '#100000',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 標題 */}
      <div style={{
        color: '#fff',
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
      }}>
        {audioPages[currentPage].title}
      </div>

      {/* 頁面指示器 */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '20px',
      }}>
        {audioPages.map((_, index) => (
          <div
            key={index}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: index === currentPage ? '#fff' : 'rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onClick={() => setCurrentPage(index)}
          />
        ))}
      </div>

      {/* 音樂播放器容器 */}
      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '25px',
          background: 'linear-gradient(145deg, #556b23, #6b8e23)',
          borderRadius: '2%',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          border: '6px solid #8fbc87',
          transform: `translateX(${currentPage * -100}px)`,
          transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {audioPages[currentPage].buttons.map((button, index) => (
          <button
            key={index}
            style={{
              ...buttonStyle,
              background: `linear-gradient(145deg, ${pageColors[currentPage][index]}, ${pageColors[currentPage][index].replace('e6', 'cc')})`,
              ...(currentButton === index ? pressedStyle : {}),
            }}
            onClick={() => playMusic(button.filename, index)}
            onMouseEnter={(e) => {
              if (currentButton !== index) {
                Object.assign(e.target.style, hoverStyle);
              }
            }}
            onMouseLeave={(e) => {
              if (currentButton !== index) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = buttonStyle.boxShadow;
              }
            }}
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

      {/* 導航提示 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: '14px',
        textAlign: 'center',
        }}>
      </div>

      {/* 左右箭頭 */}
      {currentPage > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '30px',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'color 0.3s ease',
          }}
          onClick={() => setCurrentPage(currentPage - 1)}
          onMouseEnter={(e) => e.target.style.color = '#fff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.7)'}
        >
          ◀
        </div>
      )}

      {currentPage < audioPages.length - 1 && (
        <div
          style={{
            position: 'absolute',
            right: '20px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '30px',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'color 0.3s ease',
          }}
          onClick={() => setCurrentPage(currentPage + 1)}
          onMouseEnter={(e) => e.target.style.color = '#fff'}
          onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.7)'}
        >
          ▶
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;