const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {};
const observable = initial => {
    let value = initial;
    return function (...args) { if (args.length) value = args[0]; return value; };
};
let Popup, rpc, languageChanged;
const documentRoot = {lang:'es'};
class Base {
    addObservables(values) { for (const [key,value] of Object.entries(values)) this[key] = observable(value); }
    static showModal() { Popup = new this(); Popup.beforeShow(); }
}
vm.runInNewContext(fs.readFileSync(__dirname + '/../seguimiento.js','utf8'), {
    window: {rl:true, MutationObserver: class { constructor(callback) {languageChanged=callback;} observe() {} }}, ko: {observable,computed:fn=>fn},
    rl: {adminArea:()=>false, pluginPopupView:Base, pluginRemoteRequest(callback,action,params) {
        Promise.resolve().then(()=>rpc(action,params)).then(result=>callback(0,{Result:result}),()=>callback(1));
    }},
    document: {documentElement:documentRoot, getElementById:()=>({content:{querySelector:()=>({prepend(){}})}}),createElement:()=>({setAttribute(){}})},
    addEventListener:(name,fn)=>{handlers[name]=fn;}
});
(async () => {
    let rows = [], fail = false;
    rpc = (action,params) => {
        if (fail) throw Error('unavailable');
        if (action === 'SeguimientoSave') { rows=[{...params,id:'synthetic'}]; return {ok:true,item:rows[0]}; }
        if (action === 'SeguimientoRemove') { rows=[]; return {ok:true,removed:true}; }
        return {ok:true,items:rows,account:'demo@example.invalid'};
    };
    const view={viewModelTemplateID:'MailFolderList'};
    handlers['rl-view-model.create']({detail:view});
    view.openSeguimiento();
    await new Promise(resolve=>setTimeout(resolve,10));
    Popup.edit({message_id:'<demo@example.invalid>',folder:'INBOX',uid:1,subject:'Demo',sender:'Demo'});
    Popup.note('Check reply'); Popup.due('2026-01-01');
    await Popup.save();
    assert.equal(Popup.items().length,1);
    assert.equal(Popup.current.note,'Check reply');
    Popup.filter('esperar'); assert.equal(Popup.visibleItems().length,0);
    Popup.filter('responder'); assert.equal(Popup.visibleItems().length,1);
    Popup.state('resuelto'); await Popup.save();
    assert.equal(Popup.activeCount(),0);
    Popup.filter('todos'); assert.equal(Popup.visibleItems().length,1);
    fail=true; await Popup.remove();
    assert.equal(Popup.items().length,1); assert.ok(Popup.error()); assert.equal(Popup.busy(),false);
    fail=false; await Popup.remove();
    assert.equal(Popup.items().length,0); assert.equal(Popup.editing(),false);
    rows = [{id:'first',state:'responder'},{id:'second',state:'esperar'}];
    await Popup.load();
    Popup.edit(rows[1]);
    rpc = (action,params) => {
        if (action === 'SeguimientoRemove') {
            assert.equal(params.id,'first'); rows=rows.filter(row=>row.id!==params.id);
            return {ok:true,removed:true};
        }
        return {ok:true,items:rows,account:'demo@example.invalid'};
    };
    await Popup.removeItem(rows[0]);
    assert.equal(Popup.items().length,1);
    assert.equal(Popup.current.id,'second');
    assert.equal(Popup.editing(),true);
    rpc = action => action === 'SeguimientoRemove' ? {ok:true,removed:false} : {ok:true,items:rows,account:'demo@example.invalid'};
    await Popup.removeItem(rows[0]);
    assert.equal(Popup.items().length,1);
    assert.equal(Popup.current.id,'second');
    assert.ok(Popup.error());
    console.log('OK: direct row removal preserves unrelated editor; unconfirmed removal preserves rows');
    documentRoot.lang = 'ca-ES'; languageChanged();
    assert.equal(Popup.t('title'),'Seguiment del correu');
    assert.equal(view.seguimientoLabel(),'Seguiment');
    assert.equal(Popup.label({state:'responder'}),'Per respondre');
    assert.equal(Popup.formattedDate({due:''}),'Sense data');
    assert.equal(Popup.current.state,'esperar');
    Popup.noticeKey('saved');
    assert.equal(Popup.notice(),'Seguiment desat.');
    rpc = () => ({ok:false,error:'Fecha de revisión no válida'});
    await Popup.load();
    assert.equal(Popup.error(),'Data de revisió no vàlida');
    rpc = () => ({ok:false,error:'Unknown upstream connection details'});
    await Popup.load();
    assert.equal(Popup.error(),'No s’ha pogut completar l’operació. Comprova la sessió i la connexió.');
    documentRoot.lang = 'es'; languageChanged();
    assert.equal(Popup.notice(),'Seguimiento guardado.');
    assert.equal(view.seguimientoLabel(),'Seguimiento');
    documentRoot.lang = 'fr'; languageChanged();
    assert.equal(Popup.t('title'),'Seguimiento del correo');
    console.log('OK: Catalan variants, live language changes, translated notices/errors and Spanish fallback');
    console.log('OK: follow-up save, filters, resolved state, failure recovery and removal');
})().catch(error=>{console.error(error);process.exitCode=1;});
