import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';

const QuantumDNA = () => {
  const containerRef = useRef(null);
  const [growthLevel, setGrowthLevel] = useState(0);
  const [particleCount, setParticleCount] = useState(1);
  const [activeCount, setActiveCount] = useState(1);
  const [helixCount, setHelixCount] = useState(1);
  const [audioStarted, setAudioStarted] = useState(false);
  const audioInitRef = useRef(false);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 音樂系統初始化（使用免版稅音訊檔案）
    const initAudio = async () => {
      if (audioInitRef.current) return;
      audioInitRef.current = true;

      try {
        await Tone.start();
        
        // 混響效果（增強空間感）
        const reverb = new Tone.Reverb({
          decay: 5,
          wet: 0.35
        }).toDestination();

        // 載入本地史詩音樂（請確保檔案存在於 public/audio/）
        const player = new Tone.Player({
          url: 'epic-cinematic-trailer.mp3',
          loop: true,
          volume: -10
        }).connect(reverb);

        player.on('load', () => {
          console.log('✅ 史詩音樂載入完成，開始播放');
          player.start(0);
          setAudioStarted(true);
        });

        player.on('error', (err) => {
          console.error('❌ 音樂載入失敗:', err);
          setAudioStarted(true); // 解除按鈕鎖定
        });
      } catch (err) {
        console.error(' Tone 初始化失敗:', err);
        setAudioStarted(true);
      }
    };
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 30, 100);
    
    const camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    camera.position.set(30, 20, 30);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);
    
    // 粒子系統
    const maxParticles = 100000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const colors = new Float32Array(maxParticles * 3);
    
    // 初始化混沌狀態
    for (let i = 0; i < maxParticles; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      
      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.3;
      colors[i * 3 + 2] = 0.5;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    
    const particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    
    // 連接線系統
    const lineGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(maxParticles * 12);
    const lineColors = new Float32Array(maxParticles * 12);
    
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
    
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });
    
    const lineSystem = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSystem);
    
    // 成長變數
    let currentLevel = 0;
    let activeCount = 1;
    let lastUpdate = Date.now();
    let animationTime = 0;
    
    // 8個方向向量（上下左右及對角）
    const directions = [
      new THREE.Vector3(1, 0, 0),      // 右
      new THREE.Vector3(-1, 0, 0),     // 左
      new THREE.Vector3(0, 1, 0),      // 上
      new THREE.Vector3(0, -1, 0),     // 下
      new THREE.Vector3(0, 0, 1),      // 前
      new THREE.Vector3(0, 0, -1),     // 後
      new THREE.Vector3(0.707, 0.707, 0),    // 右上
      new THREE.Vector3(-0.707, 0.707, 0),   // 左上
      new THREE.Vector3(0.707, -0.707, 0),   // 右下
      new THREE.Vector3(-0.707, -0.707, 0),  // 左下
      new THREE.Vector3(0.707, 0, 0.707),    // 右前
      new THREE.Vector3(-0.707, 0, 0.707),   // 左前
      new THREE.Vector3(0.707, 0, -0.707),   // 右後
      new THREE.Vector3(-0.707, 0, -0.707),  // 左後
      new THREE.Vector3(0, 0.707, 0.707),    // 上前
      new THREE.Vector3(0, -0.707, 0.707),   // 下前
    ];
    
    // 計算螺旋數量（對數增長）
    const getHelixCount = (level) => {
      if (level === 0) return 1;
      return Math.min(Math.pow(2, Math.floor(level / 2)), 10000);
    };
    
    // 生成多方向DNA螺旋位置
    const getDNAPosition = (index, total, level) => {
      const currentHelixCount = getHelixCount(level);
      const particlesPerHelix = Math.max(Math.floor(total / currentHelixCount), 1);
      const helixIndex = Math.floor(index / particlesPerHelix);
      const indexInHelix = index % particlesPerHelix;
      const progressInHelix = indexInHelix / Math.max(particlesPerHelix, 1);
      
      // 為每條螺旋分配一個方向（亂中有序）
      const directionIndex = helixIndex % directions.length;
      const baseDirection = directions[directionIndex].clone();
      
      // 添加隨機偏移（亂中有序）
      const randomOffset = new THREE.Vector3(
        Math.sin(helixIndex * 2.718) * 0.3,
        Math.cos(helixIndex * 3.141) * 0.3,
        Math.sin(helixIndex * 1.618) * 0.3
      );
      
      const direction = baseDirection.clone().add(randomOffset).normalize();
      
      // 螺旋參數
      const turns = 8 + (level * 0.3);
      const angle = progressInHelix * Math.PI * 2 * turns;
      const length = progressInHelix * (15 + level * 0.8);
      
      // 雙股
      const strand = indexInHelix % 2;
      const strandPhase = strand * Math.PI;
      
      // 螺旋半徑
      const spiralRadius = 1.5 + Math.sin(progressInHelix * Math.PI * 6) * 0.4;
      
      // 計算螺旋的局部座標
      const perpendicular1 = new THREE.Vector3();
      const perpendicular2 = new THREE.Vector3();
      
      // 生成兩個垂直於方向的向量
      if (Math.abs(direction.y) < 0.9) {
        perpendicular1.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
      } else {
        perpendicular1.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
      }
      perpendicular2.crossVectors(direction, perpendicular1).normalize();
      
      // 螺旋中心線位置
      const centerPos = direction.clone().multiplyScalar(length);
      
      // 螺旋偏移
      const spiralOffset = perpendicular1.clone()
        .multiplyScalar(Math.cos(angle + strandPhase) * spiralRadius)
        .add(perpendicular2.clone().multiplyScalar(Math.sin(angle + strandPhase) * spiralRadius));
      
      const finalPos = centerPos.add(spiralOffset);
      
      return {
        pos: finalPos,
        helixIndex: helixIndex,
        strandIndex: strand,
        progressInHelix: progressInHelix,
        indexInHelix: indexInHelix
      };
    };
    
    // 彩虹色彩
    const getColor = (helixIndex, progress) => {
      const hue = ((helixIndex * 0.618033988749895) % 1) * 0.85 + progress * 0.15;
      const saturation = 0.8 + Math.sin(progress * Math.PI * 4) * 0.15;
      const lightness = 0.5 + Math.sin(helixIndex * 1.234 + progress * Math.PI * 2) * 0.2;
      
      return new THREE.Color().setHSL(hue, saturation, lightness);
    };
    
    const animate = () => {
      requestAnimationFrame(animate);
      animationTime += 0.01;
      
      // 每秒增長
      const now = Date.now();
      if (now - lastUpdate >= 1000 && currentLevel < 64) {
        currentLevel++;
        activeCount = Math.min(Math.pow(2, currentLevel), maxParticles);
        const currentHelixCount = getHelixCount(currentLevel);
        lastUpdate = now;
        setGrowthLevel(currentLevel);
        setParticleCount(Math.pow(2, currentLevel));
        setActiveCount(activeCount);
        setHelixCount(currentHelixCount);
      }
      
      const posArray = geometry.attributes.position.array;
      const colorArray = geometry.attributes.color.array;
      const linePos = lineGeometry.attributes.position.array;
      const lineCol = lineGeometry.attributes.color.array;
      
      let lineIndex = 0;
      const currentHelixCount = getHelixCount(currentLevel);
      const particlesPerHelix = Math.max(Math.floor(activeCount / currentHelixCount), 1);
      
      // 更新粒子
      for (let i = 0; i < maxParticles; i++) {
        if (i < activeCount) {
          const dnaData = getDNAPosition(i, activeCount, currentLevel);
          const targetPos = dnaData.pos;
          
          // 量子波動
          const quantum = Math.sin(animationTime * 2.5 + i * 0.08) * 0.12;
          
          posArray[i * 3] += (targetPos.x + quantum - posArray[i * 3]) * 0.05;
          posArray[i * 3 + 1] += (targetPos.y + quantum - posArray[i * 3 + 1]) * 0.05;
          posArray[i * 3 + 2] += (targetPos.z + quantum - posArray[i * 3 + 2]) * 0.05;
          
          const color = getColor(dnaData.helixIndex, dnaData.progressInHelix);
          colorArray[i * 3] += (color.r - colorArray[i * 3]) * 0.05;
          colorArray[i * 3 + 1] += (color.g - colorArray[i * 3 + 1]) * 0.05;
          colorArray[i * 3 + 2] += (color.b - colorArray[i * 3 + 2]) * 0.05;
          
          // 連接同一螺旋的下一個粒子
          const nextInHelix = i + 1;
          if (nextInHelix < activeCount && 
              Math.floor(nextInHelix / particlesPerHelix) === dnaData.helixIndex &&
              lineIndex < maxParticles * 4) {
            
            const nextData = getDNAPosition(nextInHelix, activeCount, currentLevel);
            if (nextData.strandIndex === dnaData.strandIndex) {
              linePos[lineIndex * 3] = posArray[i * 3];
              linePos[lineIndex * 3 + 1] = posArray[i * 3 + 1];
              linePos[lineIndex * 3 + 2] = posArray[i * 3 + 2];
              
              linePos[lineIndex * 3 + 3] = posArray[nextInHelix * 3];
              linePos[lineIndex * 3 + 4] = posArray[nextInHelix * 3 + 1];
              linePos[lineIndex * 3 + 5] = posArray[nextInHelix * 3 + 2];
              
              lineCol[lineIndex * 3] = colorArray[i * 3];
              lineCol[lineIndex * 3 + 1] = colorArray[i * 3 + 1];
              lineCol[lineIndex * 3 + 2] = colorArray[i * 3 + 2];
              
              lineCol[lineIndex * 3 + 3] = colorArray[nextInHelix * 3];
              lineCol[lineIndex * 3 + 4] = colorArray[nextInHelix * 3 + 1];
              lineCol[lineIndex * 3 + 5] = colorArray[nextInHelix * 3 + 2];
              
              lineIndex += 2;
            }
          }
          
          // 連接雙股
          if (dnaData.indexInHelix % 4 === 0 && lineIndex < maxParticles * 4) {
            const pairIndex = dnaData.strandIndex === 0 ? i + 1 : i - 1;
            const pairHelixStart = dnaData.helixIndex * particlesPerHelix;
            
            if (pairIndex >= pairHelixStart && 
                pairIndex < pairHelixStart + particlesPerHelix && 
                pairIndex < activeCount) {
              
              linePos[lineIndex * 3] = posArray[i * 3];
              linePos[lineIndex * 3 + 1] = posArray[i * 3 + 1];
              linePos[lineIndex * 3 + 2] = posArray[i * 3 + 2];
              
              linePos[lineIndex * 3 + 3] = posArray[pairIndex * 3];
              linePos[lineIndex * 3 + 4] = posArray[pairIndex * 3 + 1];
              linePos[lineIndex * 3 + 5] = posArray[pairIndex * 3 + 2];
              
              lineCol[lineIndex * 3] = colorArray[i * 3] * 0.6;
              lineCol[lineIndex * 3 + 1] = colorArray[i * 3 + 1] * 0.6;
              lineCol[lineIndex * 3 + 2] = colorArray[i * 3 + 2] * 0.6;
              
              lineCol[lineIndex * 3 + 3] = colorArray[pairIndex * 3] * 0.6;
              lineCol[lineIndex * 3 + 4] = colorArray[pairIndex * 3 + 1] * 0.6;
              lineCol[lineIndex * 3 + 5] = colorArray[pairIndex * 3 + 2] * 0.6;
              
              lineIndex += 2;
            }
          }
          
        } else {
          colorArray[i * 3] += (0.05 - colorArray[i * 3]) * 0.02;
          colorArray[i * 3 + 1] += (0.05 - colorArray[i * 3 + 1]) * 0.02;
          colorArray[i * 3 + 2] += (0.1 - colorArray[i * 3 + 2]) * 0.02;
        }
      }
      
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;
      lineGeometry.setDrawRange(0, lineIndex);
      
      // 相機動態移動
      const cameraDistance = 35 + currentLevel * 0.6;
      camera.position.x = Math.sin(animationTime * 0.15) * cameraDistance;
      camera.position.z = Math.cos(animationTime * 0.15) * cameraDistance;
      camera.position.y = 20 + Math.sin(animationTime * 0.12) * 10;
      camera.lookAt(0, 0, 0);
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // 將音頻初始化函數儲存到DOM元素上以便點擊調用
    if (containerRef.current) {
      containerRef.current.__initAudio = initAudio;
    }
    
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      renderer.dispose();
      
      // 清理音頻（Tone.js 會自動處理 player，但我們停止所有）
      if (audioInitRef.current) {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        // Tone.js 會在頁面 unload 時自動釋放資源
      }
    };
  }, []);
  
  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100vh', 
      overflow: 'hidden',
      background: '#000'
    }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      {!audioStarted && (
        <div
          onClick={async () => {
            const initAudio = containerRef.current?.__initAudio;
            if (initAudio) await initAudio();
          }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 255, 255, 0.9)',
            color: '#000',
            fontSize: '24px',
            fontFamily: 'Microsoft JhengHei, Arial',
            fontWeight: 'bold',
            padding: '30px 60px',
            borderRadius: '15px',
            cursor: 'pointer',
            zIndex: 100,
            border: '3px solid #fff',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.8)',
            transition: 'all 0.3s',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translate(-50%, -50%) scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translate(-50%, -50%) scale(1)';
          }}
        >
          🎵 點擊開始史詩之旅 🎵
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#0ff',
        fontSize: '42px',
        fontFamily: 'Courier New, monospace',
        fontWeight: 'bold',
        textShadow: '0 0 20px #0ff, 0 0 40px #0ff',
        zIndex: 10
      }}>
        2<sup style={{ fontSize: '28px' }}>{growthLevel}</sup> = {particleCount >= 1000000000000 
          ? (particleCount / 1000000000000).toFixed(2) + 'T'
          : particleCount >= 1000000000
          ? (particleCount / 1000000000).toFixed(2) + 'B'
          : particleCount >= 1000000 
          ? (particleCount / 1000000).toFixed(2) + 'M'
          : particleCount >= 1000
          ? (particleCount / 1000).toFixed(1) + 'K'
          : particleCount.toLocaleString()}
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: '#fff',
        fontSize: '18px',
        fontFamily: 'Microsoft JhengHei, Arial',
        textAlign: 'center',
        zIndex: 10,
        opacity: 0.9,
        textShadow: '0 0 10px rgba(0,0,0,0.8)'
      }}>
        無限多方向DNA螺旋網絡 · 亂中有序 · 對數爆炸成長
      </div>
      
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '30px',
        color: '#0ff',
        fontSize: '14px',
        fontFamily: 'Courier New, monospace',
        zIndex: 10,
        background: 'rgba(0,0,0,0.8)',
        padding: '15px 20px',
        borderRadius: '8px',
        border: '2px solid #0ff',
        boxShadow: '0 0 20px rgba(0,255,255,0.3)'
      }}>
        <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>
          等級 {growthLevel} / 64
        </div>
        <div style={{ marginBottom: '5px' }}>
          理論粒子: {particleCount >= 1000000000000 
            ? (particleCount / 1000000000000).toFixed(2) + 'T'
            : particleCount >= 1000000000
            ? (particleCount / 1000000000).toFixed(2) + 'B'
            : particleCount >= 1000000
            ? (particleCount / 1000000).toFixed(2) + 'M'
            : particleCount.toLocaleString()}
        </div>
        <div style={{ marginBottom: '5px' }}>
          顯示粒子: {activeCount.toLocaleString()}
        </div>
        <div style={{ marginBottom: '8px', fontSize: '16px', color: '#ff0', fontWeight: 'bold' }}>
          螺旋數量: {helixCount.toLocaleString()}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>
          {growthLevel < 10 ? '混沌初開...' : 
           growthLevel < 20 ? '秩序漸現...' : 
           growthLevel < 30 ? '結構爆發...' : 
           growthLevel < 40 ? '網絡擴張...' :
           growthLevel < 50 ? '指數成長...' :
           growthLevel < 60 ? '趨向無限...' : 
           '宇宙極限...'}
        </div>
      </div>

      {/* 音樂來源標註（符合 CC BY 4.0 授權） */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        color: 'rgba(255,255,255,0.5)',
        fontSize: '10px',
        fontFamily: 'Arial, sans-serif',
        zIndex: 10
      }}>
        Music: "Epic Cinematic Trailer" by Lexin Music (CC BY 4.0)
      </div>
    </div>
  );
};

export default QuantumDNA;