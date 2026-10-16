#!/usr/bin/env python3
"""Opt-in live test using temporary synthetic follow-ups; no mail is opened."""
import os
import sys
import uuid
from pathlib import Path
from playwright.sync_api import sync_playwright

required = ['SEGUIMIENTO_URL', 'SEGUIMIENTO_EMAIL', 'SEGUIMIENTO_PASSWORD_FILE']
if any(not os.environ.get(key) for key in required):
    print('Set SEGUIMIENTO_URL, SEGUIMIENTO_EMAIL and SEGUIMIENTO_PASSWORD_FILE.')
    sys.exit(2)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1280,'height':900})
    page.set_default_timeout(45000)
    created = []
    def rpc(action, params=None):
        return page.evaluate("""({action,params})=>new Promise(resolve=>{
            rl.pluginRemoteRequest((error,data)=>resolve(data?.Result),action,params);
        })""", {'action':action,'params':params or {}})
    try:
        page.goto(os.environ['SEGUIMIENTO_URL'],wait_until='domcontentloaded')
        page.locator('input[name=Email]').fill(os.environ['SEGUIMIENTO_EMAIL'])
        page.locator('input[name=Password]').fill(Path(os.environ['SEGUIMIENTO_PASSWORD_FILE']).read_text().splitlines()[0].strip())
        page.get_by_role('button',name='Acceder',exact=True).click()
        page.locator('.seguimiento-launch').wait_for()
        language = os.environ.get('SEGUIMIENTO_TEST_LANGUAGE')
        if language:
            page.evaluate('language => {document.documentElement.lang=language;}', language)
        catalan = page.evaluate("document.documentElement.lang.toLowerCase().split(/[-_]/)[0] === 'ca'")
        edit_label = 'Edita' if catalan else 'Editar'
        for index in range(2):
            marker = 'Synthetic follow-up ' + uuid.uuid4().hex
            result = rpc('SeguimientoSave', {'message_id':'<' + uuid.uuid4().hex + '@example.invalid>',
                'folder':'INBOX','uid':1,'subject':marker,'sender':'demo@example.invalid',
                'state':'esperar','due':'','note':'Temporary integration test'})
            assert result['ok']
            created.append(result['item'])
        page.locator('.seguimiento-launch').click()
        page.get_by_role('heading', name='Seguiment del correu' if catalan else 'Seguimiento del correo', exact=True).wait_for()
        first = page.locator('.seguimiento-item').filter(has_text=created[0]['subject'])
        second = page.locator('.seguimiento-item').filter(has_text=created[1]['subject'])
        second.get_by_role('button',name=edit_label,exact=True).click()
        page.locator('.seguimiento-editor').wait_for(state='visible')
        if catalan:
            page.evaluate("() => {const v=ko.dataFor(document.querySelector('.seguimiento-panel'));v.due('2026-02-30');v.save();}")
            page.wait_for_function("document.querySelector('.seguimiento-panel .alert-error')?.textContent === 'Data de revisió no vàlida'")
            print('OK: validación del servidor traducida al catalán')
        first.locator('.seguimiento-remove').click()
        first.wait_for(state='detached')
        assert second.count() == 1
        assert page.locator('.seguimiento-editor').is_visible()
        assert page.locator('.seguimiento-editor h3').inner_text() == created[1]['subject']
        print('OK: quitar desde la lista conserva el editor de otro seguimiento')
        page.set_viewport_size({'width':390,'height':844})
        second.locator('.seguimiento-remove').click()
        second.wait_for(state='detached')
        assert page.locator('.seguimiento-editor').is_hidden()
        print('OK: quitar en móvil cierra el editor del seguimiento retirado')
        ids = {row['id'] for row in rpc('SeguimientoList')['items']}
        assert not any(row['id'] in ids for row in created)
        print('OK: retirada confirmada en servidor; no se han abierto ni cambiado correos')
    except Exception as error:
        print('FAIL:',type(error).__name__)
        sys.exit(1)
    finally:
        for row in created:
            try:
                rpc('SeguimientoRemove',{'id':row['id']})
            except Exception:
                print('Cleanup could not complete; review the temporary integration records.')
        browser.close()
