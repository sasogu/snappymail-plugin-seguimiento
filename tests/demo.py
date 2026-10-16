#!/usr/bin/env python3
"""Test the public plugin with synthetic metadata; never log in or access mail."""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1280, 'height': 900}, bypass_csp=True)
    page.goto(os.environ.get('SEGUIMIENTO_DEMO_URL', 'http://127.0.0.1:8100/'), wait_until='networkidle')
    page.wait_for_function("typeof rl?.pluginRemoteRequest === 'function'")
    page.evaluate("() => rl.settings.set('clientLanguage', 'es')")
    page.evaluate("""html => {
        const template = document.createElement('template');
        template.id = 'PopupsSeguimiento'; template.innerHTML = html;
        document.getElementById(template.id)?.remove();
        document.body.append(template);
    }""", (root / 'templates/PopupsSeguimiento.html').read_text())
    page.evaluate("""() => {
        let rows = [{id:'demo', message_id:'<demo@example.invalid>', folder:'INBOX',uid:1,
            subject:'Confirmación de la próxima reunión', sender:'Equipo de ejemplo <demo@example.invalid>',
            state:'esperar',due:'2026-01-01',note:'Confirmar los materiales para la sesión.',overdue:1}];
        rl.app.Remote.request = (action, callback, params) => {
            let result = {ok:true,items:rows,account:'demo@example.invalid'};
            if (action === 'PluginSeguimientoSave') {
                rows = [{...params,id:'demo'}]; result = {ok:true,item:rows[0]};
            } else if (action === 'PluginSeguimientoRemove') {
                rows = []; result = {ok:true,removed:true};
            } else if (action !== 'PluginSeguimientoList') {
                throw new Error('Unexpected action in synthetic test');
            }
            setTimeout(()=>callback(0,{Result:result}), 10);
        };
    }""")
    page.add_style_tag(path=str(root / 'seguimiento.css'))
    page.add_script_tag(path=str(root / 'seguimiento.js'))
    page.evaluate("""() => {
        const view={viewModelTemplateID:'MailFolderList'};
        dispatchEvent(new CustomEvent('rl-view-model.create',{detail:view}));
        view.openSeguimiento();
    }""")
    page.wait_for_function("document.querySelectorAll('.seguimiento-item').length === 1")
    page.locator('.seguimiento-item').get_by_role('button', name='Editar', exact=True).click()
    page.locator('.seguimiento-editor textarea').fill('Revisar la respuesta antes de la sesión.')
    page.get_by_role('button', name='Guardar seguimiento', exact=True).click()
    page.wait_for_function("document.querySelector('.seguimiento-note')?.textContent === 'Revisar la respuesta antes de la sesión.'")
    (root / 'docs').mkdir(exist_ok=True)
    page.locator('.seguimiento-panel').screenshot(path=str(root / 'docs/demo-desktop.png'))
    page.set_viewport_size({'width':390,'height':844})
    bounds=page.locator('.seguimiento-panel').bounding_box()
    assert bounds['x'] >= 0 and bounds['width'] <= 390
    page.locator('.seguimiento-panel').screenshot(path=str(root / 'docs/demo-mobile.png'))
    page.locator('.seguimiento-editor select').select_option('resuelto')
    page.get_by_role('button',name='Guardar seguimiento',exact=True).click()
    page.wait_for_function("document.querySelectorAll('.seguimiento-item').length === 0")
    page.locator('.seguimiento-filters select').select_option('resuelto')
    page.wait_for_function("document.querySelectorAll('.seguimiento-item').length === 1")
    page.locator('.seguimiento-item .seguimiento-remove').click()
    page.wait_for_function("document.querySelectorAll('.seguimiento-item').length === 0")
    assert page.locator('.seguimiento-editor').is_hidden()
    browser.close()
    print('OK: synthetic sidebar, edit/save, filters, removal and desktop/mobile screenshots; no real mail access')
