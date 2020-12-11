import { f as firebase$1, a as apiapp, o as occupancyapp } from './prebuild-580ac81d.js';

/**
 * `uvalib-model-ajax`
 */
class UvalibModelFBDB extends HTMLElement {
    static get observedAttributes() {
      return ['path','database','start-key'];
    }

    get path() {return this._path}
    set path(newPath) {this._path = newPath;}
    get database() {return this._database;}
    set database(newDb) {this._database = newDb;}
    get startKey() {return this._startKey;}
    set startKey(newStartKey) {this._startKey=newStartKey;} 

    constructor() {
      super();
    }
    connectedCallback() {
        if ( this._database &&  this._database.indexOf('uvalib-api')>-1 ) {
          this.fbdatabase = firebase$1.database(apiapp);
        } else {
          this.fbdatabase = firebase$1.database(occupancyapp);
        }
        //if () {}
        if (this.path) {
            
            var countRef = this.fbdatabase.ref(this.path);
            if (this._startKey) {
                countRef = countRef.orderByKey().startAt(this._startKey);
            }
            countRef.on('value', function(snapshot){  
              this._data = snapshot.val();
              this.dispatchEvent(new CustomEvent('last-response-changed', {bubbles:true,composed:true} ));
              this.dispatchEvent(new CustomEvent('uvalib-model-data-value', {bubbles:true,composed:true, detail:this._data } ));
            }.bind(this));
        }
    }

    get series() {
        if (this._data) {
            return this._data;
        } else {
            return null;
        }
    }
    get lastResponse() {return this._data;}
    get data() {return this._data;}
    get path() {return this._path;}
    set path(newPath) {this._path = newPath;} 
    get startKey() {return this._startKey;}
    set startKey(newStartKey) {this._startKey = newStartKey.toString();}
 
    attributeChangedCallback(name, oldValue, newValue) {
      switch(name){
        case "path": this.path = newValue; break;
        case "database": this.database = newValue; break;
        case "start-key": this.startKey = newValue; break;
      }
    }

   }
   
   window.customElements.define('uvalib-model-realtime-database', UvalibModelFBDB);

/**
 * `uvalib-model-alerts`
 */
class UvalibModelAlerts extends UvalibModelFBDB {
  static get observedAttributes() {
    return super.observedAttributes.concat([]);
  }
  get seen(){ 
    const seen = JSON.parse(localStorage.getItem('uvalib-alerts-seen'));
    return (Array.isArray(seen))? seen:[]; 
  }
  set seen(array2){
    var array1 = this.seen;
    if (!(array1.length === array2.length && array1.every((value, index) => value === array2[index]))) {
      var seenCount = array2.length;
      localStorage.setItem('uvalib-alerts-seen',JSON.stringify(array2));
      if (this.seen.length != seenCount) {
        this.dispatchEvent(new CustomEvent('seen-count-changed', {bubbles: true, composed: true, detail: {seenCount: array2.length}}));
      }
      this.dispatchEvent(new CustomEvent('alerts-changed', {bubbles: true, composed: true, detail: {seenCount: array2.length}}));
    }
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
