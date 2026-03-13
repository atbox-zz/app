import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import MusicPlayer from './MusicPlayer.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <App />*/}
    {/* <SoundApp />*/}
        <MusicPlayer />
  </StrictMode>,
)
