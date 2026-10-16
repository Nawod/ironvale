import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './ui/game-hud.css';
import './ui/medieval-hud.css';
import './ui/medieval-shell.css';
createRoot(document.getElementById('root')!).render(<App/>);
