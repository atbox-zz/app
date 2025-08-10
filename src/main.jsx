import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
//import './index.css'
//import App from './App.jsx'
//import './SoundApp.css'
//import SoundApp from './SoundApp.jsx'
import MusicPlayer4 from './MusicPlayer4.jsx'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* <App />*/}
    {/* <SoundApp />*/}
        <MusicPlayer4 />
  </StrictMode>,
)
