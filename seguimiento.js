/* global ko, rl */
(() => {
    'use strict';
    if (!window.rl || rl.adminArea()) return;

    const rpc = (action, params = {}) => new Promise((resolve, reject) => {
        rl.pluginRemoteRequest((error, data) => {
            const result = data && data.Result;
            if (error || !result || !result.ok) {
                reject(new Error(result?.error || 'No se pudo completar la operación. Vuelve a intentarlo.'));
            } else resolve(result);
        }, action, params);
    });
    const labels = { responder: 'Por responder', esperar: 'En espera', resuelto: 'Resuelto' };
    const messageKey = value => value ? '<' + String(value).trim().replace(/^<|>$/g, '') + '>' : '';
    const localDate = () => {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    class SeguimientoPopup extends rl.pluginPopupView {
        constructor() {
            super('Seguimiento');
            this.addObservables({
                items: [], account: '', filter: 'activos', busy: false, error: '', notice: '',
                editing: false, subject: '', sender: '', state: 'responder', due: '', note: ''
            });
            this.visibleItems = ko.computed(() => this.items().filter(item => {
                if (this.filter() === 'vencidos') return item.state !== 'resuelto' && item.due && item.due <= localDate();
                if (this.filter() === 'todos') return true;
                if (this.filter() === 'activos') return item.state !== 'resuelto';
                return item.state === this.filter();
            }));
            this.activeCount = ko.computed(() => this.items().filter(item => item.state !== 'resuelto').length);
            this.dueCount = ko.computed(() => this.items().filter(item => item.state !== 'resuelto' && item.due && item.due <= localDate()).length);
            this.label = item => labels[item.state] || item.state;
            this.isDue = item => item.state !== 'resuelto' && item.due && item.due <= localDate();
            this.formattedDate = item => item.due ? item.due.split('-').reverse().join('/') : 'Sin fecha';
            this.editItem = item => this.edit(item);
            this.removeItem = item => this.removeTracked(item);
            this.openItem = item => this.open(item);
            this.current = null;
        }

        async beforeShow(message = null) {
            this.error(''); this.notice(''); this.editing(false); this.current = null;
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
            } catch (error) { this.error(error.message); }
            finally { this.busy(false); }
        }

        edit(item) {
            this.current = { ...item };
            this.subject(item.subject || '(Sin asunto)'); this.sender(item.sender || '');
            this.state(item.state || 'responder'); this.due(item.due || ''); this.note(item.note || '');
            this.editing(true); this.error(''); this.notice('');
        }

        async save() {
            if (this.busy() || !this.current) return;
            this.busy(true); this.error(''); this.notice('');
            try {
                const result = await rpc('SeguimientoSave', {
                    message_id: this.current.message_id, folder: this.current.folder,
                    uid: this.current.uid, subject: this.current.subject || '',
                    sender: this.current.sender || '', state: this.state(), due: this.due(), note: this.note()
                });
                this.current = result.item;
                this.notice('Seguimiento guardado.');
            } catch (error) { this.error(error.message); }
            finally { this.busy(false); }
            await this.load();
        }

        async open(item) {
            this.busy(true); this.error('');
            try {
                const result = await rpc('SeguimientoLocate', { id: item.id });
                this.close();
                dispatchEvent(new CustomEvent('mailbox.message.show', {
                    detail: { folder: result.folder, uid: result.uid }
                }));
            } catch (error) { this.error(error.message); }
            finally { this.busy(false); }
        }

        async remove() { return this.removeTracked(this.current); }

        async removeTracked(item) {
            if (this.busy() || !item?.id) return;
            this.busy(true); this.error('');
            try {
                const result = await rpc('SeguimientoRemove', { id: item.id });
                if (!result.removed) throw new Error('No se pudo quitar el seguimiento. Actualiza la lista y vuelve a intentarlo.');
                if (this.current?.id === item.id) {
                    this.editing(false); this.current = null;
                }
                this.notice('Seguimiento retirado. El correo se conserva.');
            } catch (error) { this.error(error.message); }
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
            const button = document.createElement('button');
            button.type = 'button'; button.className = 'btn seguimiento-launch';
            button.textContent = 'Seguimiento';
            button.setAttribute('data-bind', 'click: openSeguimiento');
            template.content.querySelector('.b-content')?.prepend(button);
        }
        if (view.viewModelTemplateID === 'MailMessageView') {
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
            button.textContent = 'Seguimiento';
            button.setAttribute('data-bind', 'click: trackSeguimiento, enable: messageVisible');
            template.content.querySelector('.messageItemHeader')?.after(button);
        }
    });
})();
