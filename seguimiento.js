/* global ko, rl */
(() => {
    'use strict';
    if (!window.rl || rl.adminArea()) return;

    const strings = {
        es: {
            launcher: 'Seguimiento', title: 'Seguimiento del correo',
            subtitle: 'Lo que tienes que hacer y las respuestas que esperas.',
            account: 'Cuenta:', active: 'activos', reviewCount: 'para revisar', state: 'Estado',
            responder: 'Por responder', esperar: 'En espera', resuelto: 'Resuelto',
            needReply: 'Tengo que responder', waitingReply: 'Espero respuesta',
            due: 'Fecha de revisión', note: 'Próxima acción o nota',
            placeholder: 'Por ejemplo: reclamar la confirmación de fechas',
            save: 'Guardar seguimiento', remove: 'Quitar seguimiento', show: 'Mostrar',
            filterActive: 'Todos los activos', filterDue: 'Para revisar hoy o vencidos',
            filterWaiting: 'Esperando respuesta', filterResolved: 'Resueltos',
            filterAll: 'Todos, incluidos resueltos', refresh: 'Actualizar',
            empty: 'No hay seguimientos en esta vista. Abre un mensaje y pulsa «Seguimiento» para añadirlo.',
            review: 'Revisar', subject: '(Sin asunto)', noDate: 'Sin fecha',
            edit: 'Editar', open: 'Abrir correo', close: 'Cerrar',
            footer: 'Las fechas indican cuándo revisar. No se envían avisos externos.',
            saved: 'Seguimiento guardado.', removed: 'Seguimiento retirado. El correo se conserva.',
            removeError: 'No se pudo quitar el seguimiento. Actualiza la lista y vuelve a intentarlo.',
            unavailable: 'No se pudo completar la operación. Comprueba la sesión y la conexión.',
            invalidText: 'Texto no válido o demasiado largo', required: 'Falta un dato obligatorio',
            invalidMessageId: 'Message-ID no válido', invalidUid: 'Identificador IMAP no válido',
            invalidState: 'Estado no válido', invalidDate: 'Fecha de revisión no válida',
            missing: 'No se encuentra este seguimiento en la cuenta actual',
            moved: 'El mensaje se ha movido o eliminado. Búscalo por su asunto y vuelve a guardar el seguimiento.'
        },
        ca: {
            launcher: 'Seguiment', title: 'Seguiment del correu',
            subtitle: 'El que has de fer i les respostes que esperes.',
            account: 'Compte:', active: 'actius', reviewCount: 'per revisar', state: 'Estat',
            responder: 'Per respondre', esperar: 'En espera', resuelto: 'Resolt',
            needReply: 'He de respondre', waitingReply: 'Espero resposta',
            due: 'Data de revisió', note: 'Acció següent o nota',
            placeholder: 'Per exemple: demanar la confirmació de dates',
            save: 'Desa el seguiment', remove: 'Treu del seguiment', show: 'Mostra',
            filterActive: 'Tots els actius', filterDue: 'Per revisar avui o vençuts',
            filterWaiting: 'Esperant resposta', filterResolved: 'Resolts',
            filterAll: 'Tots, inclosos els resolts', refresh: 'Actualitza',
            empty: 'No hi ha seguiments en aquesta vista. Obre un missatge i prem «Seguiment» per afegir-ne un.',
            review: 'Revisa', subject: '(Sense assumpte)', noDate: 'Sense data',
            edit: 'Edita', open: 'Obre el correu', close: 'Tanca',
            footer: 'Les dates indiquen quan cal revisar. No s’envien avisos externs.',
            saved: 'Seguiment desat.', removed: 'Seguiment retirat. El correu es conserva.',
            removeError: 'No s’ha pogut treure del seguiment. Actualitza la llista i torna-ho a provar.',
            unavailable: 'No s’ha pogut completar l’operació. Comprova la sessió i la connexió.',
            invalidText: 'Text no vàlid o massa llarg', required: 'Falta una dada obligatòria',
            invalidMessageId: 'Message-ID no vàlid', invalidUid: 'Identificador IMAP no vàlid',
            invalidState: 'Estat no vàlid', invalidDate: 'Data de revisió no vàlida',
            missing: 'No es troba aquest seguiment al compte actual',
            moved: 'El missatge s’ha mogut o eliminat. Cerca’l per l’assumpte i torna a desar el seguiment.'
        }
    };
    const readLanguage = () => String(document.documentElement?.lang || rl.settings?.get('clientLanguage') || 'es')
        .toLowerCase().split(/[-_]/)[0];
    const language = ko.observable(readLanguage());
    const t = key => (strings[language()] || strings.es)[key] || (strings[language()] || strings.es).unavailable;
    if (window.MutationObserver) {
        new window.MutationObserver(() => language(readLanguage())).observe(document.documentElement,
            {attributes: true, attributeFilter: ['lang']});
    }
    // Translate only known validation messages; never display arbitrary upstream errors.
    const errorKeys = Object.fromEntries(['invalidText', 'required', 'invalidMessageId', 'invalidUid',
        'invalidState', 'invalidDate', 'missing', 'moved', 'unavailable'].map(key => [strings.es[key], key]));

    const rpc = (action, params = {}) => new Promise((resolve, reject) => {
        rl.pluginRemoteRequest((error, data) => {
            const result = data && data.Result;
            if (error || !result || !result.ok) {
                reject(new Error(errorKeys[result?.error] || 'unavailable'));
            } else resolve(result);
        }, action, params);
    });
    const messageKey = value => value ? '<' + String(value).trim().replace(/^<|>$/g, '') + '>' : '';
    const localDate = () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    class SeguimientoPopup extends rl.pluginPopupView {
        constructor() {
            super('Seguimiento');
            this.addObservables({
                items: [], account: '', filter: 'activos', busy: false, errorKey: '', noticeKey: '',
                editing: false, subject: '', sender: '', state: 'responder', due: '', note: ''
            });
            this.t = t;
            this.error = ko.computed(() => this.errorKey() ? t(this.errorKey()) : '');
            this.notice = ko.computed(() => this.noticeKey() ? t(this.noticeKey()) : '');
            this.visibleItems = ko.computed(() => this.items().filter(item => {
                if (this.filter() === 'vencidos') return item.state !== 'resuelto' && item.due && item.due <= localDate();
                if (this.filter() === 'todos') return true;
                if (this.filter() === 'activos') return item.state !== 'resuelto';
                return item.state === this.filter();
            }));
            this.activeCount = ko.computed(() => this.items().filter(item => item.state !== 'resuelto').length);
            this.dueCount = ko.computed(() => this.items().filter(item => item.state !== 'resuelto' && item.due && item.due <= localDate()).length);
            this.label = item => t(item.state);
            this.isDue = item => item.state !== 'resuelto' && item.due && item.due <= localDate();
            this.formattedDate = item => item.due ? item.due.split('-').reverse().join('/') : t('noDate');
            this.editItem = item => this.edit(item);
            this.removeItem = item => this.removeTracked(item);
            this.openItem = item => this.open(item);
            this.current = null;
        }

        async beforeShow(message = null) {
            this.errorKey(''); this.noticeKey(''); this.editing(false); this.current = null;
            this.filter('activos');
            await this.load();
            if (message) {
                const item = this.items().find(row => row.message_id === message.message_id);
                this.edit(item ? { ...item, folder: message.folder, uid: message.uid } : message);
            }
        }

        async load() {
            this.busy(true);
            try {
                const result = await rpc('SeguimientoList');
                this.items(result.items); this.account(result.account);
            } catch (error) { this.errorKey(error.message); }
            finally { this.busy(false); }
        }

        edit(item) {
            this.current = { ...item };
            this.subject(item.subject || ''); this.sender(item.sender || '');
            this.state(item.state || 'responder'); this.due(item.due || ''); this.note(item.note || '');
            this.editing(true); this.errorKey(''); this.noticeKey('');
        }

        async save() {
            if (this.busy() || !this.current) return;
            this.busy(true); this.errorKey(''); this.noticeKey('');
            try {
                const result = await rpc('SeguimientoSave', {
                    message_id: this.current.message_id, folder: this.current.folder,
                    uid: this.current.uid, subject: this.current.subject || '',
                    sender: this.current.sender || '', state: this.state(), due: this.due(), note: this.note()
                });
                this.current = result.item;
                this.noticeKey('saved');
            } catch (error) { this.errorKey(error.message); }
            finally { this.busy(false); }
            await this.load();
        }

        async open(item) {
            this.busy(true); this.errorKey('');
            try {
                const result = await rpc('SeguimientoLocate', { id: item.id });
                this.close();
                dispatchEvent(new CustomEvent('mailbox.message.show', {
                    detail: { folder: result.folder, uid: result.uid }
                }));
            } catch (error) { this.errorKey(error.message); }
            finally { this.busy(false); }
        }

        async remove() { return this.removeTracked(this.current); }

        async removeTracked(item) {
            if (this.busy() || !item?.id) return;
            this.busy(true); this.errorKey('');
            try {
                const result = await rpc('SeguimientoRemove', { id: item.id });
                if (!result.removed) throw new Error('removeError');
                if (this.current?.id === item.id) {
                    this.editing(false); this.current = null;
                }
                this.noticeKey('removed');
            } catch (error) { this.errorKey(error.message); }
            finally { this.busy(false); }
            await this.load();
        }
    }

    const showPanel = () => SeguimientoPopup.showModal();
    addEventListener('rl-view-model.create', event => {
        const view = event.detail;
        const template = document.getElementById(view.viewModelTemplateID);
        if (!template?.content) return;
        if (view.viewModelTemplateID === 'MailFolderList') {
            view.openSeguimiento = showPanel;
            view.seguimientoLabel = () => t('launcher');
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'btn seguimiento-launch';
            button.textContent = t('launcher');
            button.setAttribute('data-bind', 'click: openSeguimiento, text: seguimientoLabel()');
            template.content.querySelector('.b-content')?.prepend(button);
        }
        if (view.viewModelTemplateID === 'MailMessageView') {
            view.seguimientoLabel = () => t('launcher');
            view.trackSeguimiento = () => {
                const message = view.message();
                if (!message) return;
                SeguimientoPopup.showModal([{
                    message_id: messageKey(message.messageId), folder: message.folder, uid: message.uid,
                    subject: message.subject(), sender: message.senderClearEmailsString ||
                        (message.from || []).map(sender => sender.email).join(', ')
                }]);
            };
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'btn seguimiento-message';
            button.textContent = t('launcher');
            button.setAttribute('data-bind', 'click: trackSeguimiento, enable: messageVisible, text: seguimientoLabel()');
            template.content.querySelector('.messageItemHeader')?.after(button);
        }
    });
})();
