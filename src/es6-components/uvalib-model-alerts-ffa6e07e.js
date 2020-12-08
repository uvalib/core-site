import { U as UvalibModelFBDB } from './prebuild-f8a606a3.js';

//import UvalibModelLibrary from "./uvalib-model-library.js";

/**
 * `uvalib-model-library`
 */
class UvalibModelAlerts extends UvalibModelFBDB {
  static get observedAttributes() {
    return super.observedAttributes.concat([]);
  }
  get seen(){ 
    const seen = JSON.parse(localStorage.getItem('uvalib-alerts-seen'));
    return (Array.isArray(seen))? seen:[]; 
  }
  set seen(seenItems){ 
    localStorage.setItem('uvalib-alerts-seen',JSON.stringify(seenItems));
    this.dispatchEvent(new CustomEvent('seen-count-changed', {bubbles: true, composed: true, detail: {seenCount: seenItems.length}}));
  }
  get seenCount(){ return this.seen.length }
  get alerts(){
    if (Array.isArray(this.lastResponse) && this.lastResponse.length>0) {
      return this.lastResponse.map(function(alert) {
        if (alert.severity==="alert3") {this.setSeen(alert.uuid);}
        if (this.seen && this.seen.indexOf(alert.uuid)>-1) {alert.seen = true;}
        else {alert.seen = false;}
        return alert;
      }.bind(this)).sort(function(x,y){return x.severity>y.severity});
    } else 
      return [];
  }
  constructor() {
    super();
    this.path = "library-alerts";
    this.database = "https://uvalib-api.firebaseio.com/";
  }
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('uvalib-model-data-value',function(e){           //'last-response-changed',function(e){
      this.dispatchEvent(new CustomEvent('alerts-changed', {bubbles: true, composed: true}));
    }.bind(this));
    window.addEventListener('storage', function() {
      this.dispatchEvent(new CustomEvent('seen-count-changed', {bubbles: true, composed: true, detail: {seenCount: this.seen.length}}));
    }.bind(this));
    this.dispatchEvent(new CustomEvent('seen-count-changed', {bubbles: true, composed: true, detail: {seenCount: this.seenCount }}));
  }
  setSeen(uuid){
    var seen = new Set(this.seen);
    seen.add(uuid);
    this.seen = [... seen];
  }
  setAllUnSeen(){
    this.seen = [];
  }
  setAllSeen(){
    this.seen = this.alerts.map(a=>a.uuid);
  }
}

window.customElements.define('uvalib-model-alerts', UvalibModelAlerts);

export default UvalibModelAlerts;
