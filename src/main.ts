import './style.css';
import {Game} from './game/Game.ts';
import {AssetGallery} from './ui/AssetGallery.ts';
const game=new Game();
const gallery=new AssetGallery();
// Useful for Playwright, in-browser QA and developer consoles.
if(import.meta.env.DEV)(window as Window & {__WILDLANDS__?:Game}).__WILDLANDS__=game;
if(import.meta.hot)import.meta.hot.dispose(()=>{gallery.dispose();game.dispose();});
