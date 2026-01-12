/**
 * ui/dialogs.js - Dialog/popup components
 * Blacklist manager, emote manager, emote editor, export dialog.
 */
(function() {
    'use strict';

    const SNEED = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window).SNEED;
    const { stylesToString } = SNEED.util;
    const { addManagedEventListener, removeElementListeners } = SNEED.core.events;
    const storage = SNEED.core.storage;
    const { STYLES } = SNEED.ui;

    // ============================================
    // HELPER: CREATE POPUP BASE
    // ============================================

    function createPopupBase(doc, id, options = {}) {
        const popup = doc.createElement('div');
        popup.id = id;
        popup.style.cssText = stylesToString({
            ...STYLES.popup,
            maxWidth: options.maxWidth || '500px',
            maxHeight: options.maxHeight || '400px',
            overflowY: 'auto',
            zIndex: options.zIndex || '10000'
        });
        return popup;
    }

    function createTitle(doc, text) {
        const title = doc.createElement('h3');
        title.textContent = text;
        title.style.cssText = stylesToString(STYLES.popupTitle);
        return title;
    }

    function createStyledButton(doc, text, type = 'secondary', options = {}) {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.textContent = text;

        const baseStyle = STYLES.button.base;
        const typeStyle = STYLES.button[type] || STYLES.button.secondary;

        btn.style.cssText = stylesToString({
            ...baseStyle,
            ...typeStyle,
            ...(options.fullWidth ? { width: '100%' } : {}),
            ...(options.flex ? { flex: '1' } : {}),
            ...(options.marginTop ? { marginTop: options.marginTop } : {}),
            ...(options.marginBottom ? { marginBottom: options.marginBottom } : {})
        });

        // Hover effects
        const hoverBg = typeStyle.background.replace('0.3', '0.5');
        addManagedEventListener(btn, 'mouseenter', () => { btn.style.background = hoverBg; });
        addManagedEventListener(btn, 'mouseleave', () => { btn.style.background = typeStyle.background; });

        return btn;
    }

    function setupClickOutside(doc, popup, onClose) {
        const clickOutside = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                removeElementListeners(popup);
                doc.removeEventListener('click', clickOutside);
                if (onClose) onClose();
            }
        };
        setTimeout(() => doc.addEventListener('click', clickOutside), 0);
        return clickOutside;
    }

    // ============================================
    // BLACKLIST MANAGER
    // ============================================

    function showBlacklistManager(doc) {
        const existing = doc.getElementById('blacklist-manager');
        if (existing) { existing.remove(); return; }

        const blacklist = storage.getBlacklist();
        const manager = createPopupBase(doc, 'blacklist-manager');

        manager.appendChild(createTitle(doc, 'Blacklisted Images'));

        // Add URL input section
        const addSection = doc.createElement('div');
        addSection.style.cssText = 'margin-bottom: 12px; padding: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;';

        const addLabel = doc.createElement('label');
        addLabel.textContent = 'Paste image URL to blacklist:';
        addLabel.style.cssText = 'color: rgba(255, 255, 255, 0.9); font-size: 12px; display: block; margin-bottom: 8px;';
        addSection.appendChild(addLabel);

        const inputContainer = doc.createElement('div');
        inputContainer.style.cssText = 'display: flex; gap: 8px;';

        const urlInput = doc.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://example.com/image.png';
        urlInput.style.cssText = stylesToString({ ...STYLES.input, flex: '1' });

        const addUrlBtn = createStyledButton(doc, 'Blacklist', 'danger');

        const doAddUrl = () => {
            const url = urlInput.value.trim();
            if (url && storage.addToBlacklist(url)) {
                urlInput.value = '';
                manager.remove();
                showBlacklistManager(doc);
                if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
            } else if (url) {
                alert('URL is already blacklisted or invalid');
            }
        };

        addManagedEventListener(addUrlBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); doAddUrl(); });
        addManagedEventListener(urlInput, 'keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAddUrl(); } });

        inputContainer.appendChild(urlInput);
        inputContainer.appendChild(addUrlBtn);
        addSection.appendChild(inputContainer);
        manager.appendChild(addSection);

        if (blacklist.length === 0) {
            const empty = doc.createElement('p');
            empty.textContent = 'No images blacklisted';
            empty.style.cssText = 'color: rgba(255, 255, 255, 0.6); font-size: 13px; margin: 0;';
            manager.appendChild(empty);
        } else {
            const list = doc.createElement('div');
            list.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

            blacklist.forEach(url => {
                const item = doc.createElement('div');
                item.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;';

                const img = doc.createElement('img');
                img.src = url;
                img.style.cssText = 'width: 32px; height: 32px; object-fit: contain;';

                const urlText = doc.createElement('span');
                urlText.textContent = url;
                urlText.style.cssText = 'color: rgba(255, 255, 255, 0.7); font-size: 11px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

                const removeBtn = createStyledButton(doc, 'Remove', 'danger');
                removeBtn.style.padding = '4px 12px';
                removeBtn.style.fontSize = '11px';

                addManagedEventListener(removeBtn, 'click', () => {
                    if (storage.removeFromBlacklist(url)) {
                        manager.remove();
                        showBlacklistManager(doc);
                        if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
                    }
                });

                item.appendChild(img);
                item.appendChild(urlText);
                item.appendChild(removeBtn);
                list.appendChild(item);
            });

            manager.appendChild(list);

            const clearBtn = createStyledButton(doc, 'Clear All', 'danger', { fullWidth: true, marginTop: '12px' });
            addManagedEventListener(clearBtn, 'click', () => {
                if (confirm('Clear all blacklisted images?')) {
                    storage.clearBlacklist();
                    manager.remove();
                    showBlacklistManager(doc);
                    if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
                }
            });
            manager.appendChild(clearBtn);
        }

        const closeBtn = createStyledButton(doc, 'Close', 'secondary', { fullWidth: true, marginTop: '8px' });
        addManagedEventListener(closeBtn, 'click', () => { manager.remove(); removeElementListeners(manager); });
        manager.appendChild(closeBtn);

        doc.body.appendChild(manager);
        setupClickOutside(doc, manager);
    }

    // ============================================
    // EXPORT DIALOG
    // ============================================

    function showExportDialog(doc, emotesToExport) {
        const dialog = createPopupBase(doc, 'export-dialog', { minWidth: '500px', maxWidth: '700px', zIndex: '10002' });

        dialog.appendChild(createTitle(doc, 'Export Emotes'));

        const instructions = doc.createElement('p');
        instructions.textContent = 'Copy the JSON below and save it to a .json file:';
        instructions.style.cssText = 'color: rgba(255, 255, 255, 0.7); font-size: 12px; margin: 0 0 8px 0;';
        dialog.appendChild(instructions);

        const textarea = doc.createElement('textarea');
        textarea.value = JSON.stringify(emotesToExport, null, 2);
        textarea.readOnly = true;
        textarea.style.cssText = 'width: 100%; height: 300px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: rgba(255, 255, 255, 0.9); padding: 8px; font-family: monospace; font-size: 11px; resize: vertical; margin-bottom: 12px;';
        dialog.appendChild(textarea);

        const buttonContainer = doc.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const copyBtn = createStyledButton(doc, 'Copy to Clipboard', 'primary', { flex: true });
        addManagedEventListener(copyBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            textarea.select();
            try {
                doc.execCommand('copy');
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
            } catch (err) {
                alert('Failed to copy. Please manually select and copy the text.');
            }
        });

        const closeBtn = createStyledButton(doc, 'Close', 'secondary', { flex: true });
        addManagedEventListener(closeBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dialog.remove();
            removeElementListeners(dialog);
        });

        buttonContainer.appendChild(copyBtn);
        buttonContainer.appendChild(closeBtn);
        dialog.appendChild(buttonContainer);

        doc.body.appendChild(dialog);
        textarea.select();
        textarea.focus();
    }

    // ============================================
    // EMOTE EDITOR
    // ============================================

    function showEmoteEditor(doc, emote, index) {
        const existing = doc.getElementById('emote-editor');
        if (existing) existing.remove();

        const isNew = index === -1;
        const currentEmotes = storage.getEmotes();

        const editor = createPopupBase(doc, 'emote-editor', { minWidth: '400px', zIndex: '10001' });

        editor.appendChild(createTitle(doc, isNew ? 'Add New Emote' : 'Edit Emote'));

        const fieldStyle = 'display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;';
        const labelStyle = 'color: rgba(255, 255, 255, 0.9); font-size: 12px; font-weight: 500;';

        // Code field
        const codeField = doc.createElement('div');
        codeField.style.cssText = fieldStyle;
        const codeLabel = doc.createElement('label');
        codeLabel.textContent = 'Code (required):';
        codeLabel.style.cssText = labelStyle;
        const codeInput = doc.createElement('input');
        codeInput.type = 'text';
        codeInput.value = emote?.code || '';
        codeInput.placeholder = ':example:';
        codeInput.style.cssText = stylesToString(STYLES.input);
        codeField.appendChild(codeLabel);
        codeField.appendChild(codeInput);

        // Title field
        const titleField = doc.createElement('div');
        titleField.style.cssText = fieldStyle;
        const titleLabel = doc.createElement('label');
        titleLabel.textContent = 'Title:';
        titleLabel.style.cssText = labelStyle;
        const titleInput = doc.createElement('input');
        titleInput.type = 'text';
        titleInput.value = emote?.title || '';
        titleInput.placeholder = 'Emote description';
        titleInput.style.cssText = stylesToString(STYLES.input);
        titleField.appendChild(titleLabel);
        titleField.appendChild(titleInput);

        // Type selector
        const typeField = doc.createElement('div');
        typeField.style.cssText = fieldStyle;
        const typeLabel = doc.createElement('label');
        typeLabel.textContent = 'Type:';
        typeLabel.style.cssText = labelStyle;
        const typeSelect = doc.createElement('select');
        typeSelect.style.cssText = stylesToString(STYLES.input);

        [{ value: 'url', label: 'Image URL' }, { value: 'emoji', label: 'Emoji' }, { value: 'text', label: 'Text' }].forEach(type => {
            const option = doc.createElement('option');
            option.value = type.value;
            option.textContent = type.label;
            typeSelect.appendChild(option);
        });

        if (emote?.url) typeSelect.value = 'url';
        else if (emote?.emoji) typeSelect.value = 'emoji';
        else if (emote?.text) typeSelect.value = 'text';
        else typeSelect.value = 'url';

        typeField.appendChild(typeLabel);
        typeField.appendChild(typeSelect);

        // Value field
        const valueField = doc.createElement('div');
        valueField.style.cssText = fieldStyle;
        const valueLabel = doc.createElement('label');
        valueLabel.style.cssText = labelStyle;
        const valueInput = doc.createElement('input');
        valueInput.type = 'text';
        valueInput.style.cssText = stylesToString(STYLES.input);
        valueField.appendChild(valueLabel);
        valueField.appendChild(valueInput);

        const updateValueField = () => {
            const type = typeSelect.value;
            if (type === 'url') {
                valueLabel.textContent = 'Image URL:';
                valueInput.placeholder = 'https://example.com/image.png';
                valueInput.value = emote?.url || '';
            } else if (type === 'emoji') {
                valueLabel.textContent = 'Emoji:';
                valueInput.placeholder = '😀';
                valueInput.value = emote?.emoji || '';
            } else if (type === 'text') {
                valueLabel.textContent = 'Text:';
                valueInput.placeholder = 'ABC';
                valueInput.value = emote?.text || '';
            }
        };

        updateValueField();
        addManagedEventListener(typeSelect, 'change', updateValueField);

        // Auto-send checkbox
        const autoSendField = doc.createElement('div');
        autoSendField.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 16px;';
        const autoSendCheckbox = doc.createElement('input');
        autoSendCheckbox.type = 'checkbox';
        autoSendCheckbox.id = 'auto-send-checkbox';
        autoSendCheckbox.checked = emote?.autoSend !== false;
        const autoSendLabel = doc.createElement('label');
        autoSendLabel.htmlFor = 'auto-send-checkbox';
        autoSendLabel.textContent = 'Auto-send when input is empty';
        autoSendLabel.style.cssText = 'color: rgba(255, 255, 255, 0.9); font-size: 12px; cursor: pointer;';
        autoSendField.appendChild(autoSendCheckbox);
        autoSendField.appendChild(autoSendLabel);

        editor.appendChild(codeField);
        editor.appendChild(titleField);
        editor.appendChild(typeField);
        editor.appendChild(valueField);
        editor.appendChild(autoSendField);

        // Buttons
        const buttonContainer = doc.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const saveBtn = createStyledButton(doc, 'Save', 'primary', { flex: true });
        addManagedEventListener(saveBtn, 'click', () => {
            const code = codeInput.value.trim();
            if (!code) { alert('Code is required'); return; }

            const type = typeSelect.value;
            const value = valueInput.value.trim();
            if (!value) { alert(`${type === 'url' ? 'URL' : type === 'emoji' ? 'Emoji' : 'Text'} is required`); return; }

            const newEmote = { code, title: titleInput.value.trim() || undefined };
            if (type === 'url') newEmote.url = value;
            else if (type === 'emoji') newEmote.emoji = value;
            else if (type === 'text') newEmote.text = value;
            if (!autoSendCheckbox.checked) newEmote.autoSend = false;

            let updatedEmotes;
            if (isNew) {
                updatedEmotes = [...currentEmotes, newEmote];
            } else {
                updatedEmotes = [...currentEmotes];
                updatedEmotes[index] = newEmote;
            }

            storage.saveEmotes(updatedEmotes);
            editor.remove();
            showEmoteManager(doc);
            if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
        });

        const cancelBtn = createStyledButton(doc, 'Cancel', 'secondary', { flex: true });
        addManagedEventListener(cancelBtn, 'click', () => { editor.remove(); showEmoteManager(doc); });

        buttonContainer.appendChild(saveBtn);
        buttonContainer.appendChild(cancelBtn);
        editor.appendChild(buttonContainer);

        doc.body.appendChild(editor);
    }

    // ============================================
    // EMOTE MANAGER
    // ============================================

    function showEmoteManager(doc) {
        const existing = doc.getElementById('emote-manager');
        if (existing) { existing.remove(); return; }

        const currentEmotes = storage.getEmotes();
        const manager = createPopupBase(doc, 'emote-manager', { maxWidth: '600px', maxHeight: '500px' });

        manager.appendChild(createTitle(doc, 'Manage Emotes'));

        // Add button
        const addBtn = createStyledButton(doc, '+ Add New Emote', 'primary', { fullWidth: true, marginBottom: '12px' });
        addManagedEventListener(addBtn, 'click', () => { manager.remove(); showEmoteEditor(doc, null, -1); });
        manager.appendChild(addBtn);

        // Emotes list
        const list = doc.createElement('div');
        list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;';

        currentEmotes.forEach((emote, index) => {
            const item = doc.createElement('div');
            item.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255, 255, 255, 0.05); border-radius: 4px;';

            let preview;
            if (emote.url) {
                preview = doc.createElement('img');
                preview.src = emote.url;
                preview.style.cssText = 'width: 32px; height: 32px; object-fit: contain;';
            } else if (emote.emoji) {
                preview = doc.createElement('span');
                preview.textContent = emote.emoji;
                preview.style.cssText = 'font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;';
            } else if (emote.text) {
                preview = doc.createElement('span');
                preview.textContent = emote.text;
                preview.style.cssText = 'font-size: 10px; font-weight: bold; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: rgba(255, 255, 255, 0.9);';
            }

            const info = doc.createElement('div');
            info.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 2px;';

            const code = doc.createElement('span');
            code.textContent = emote.code;
            code.style.cssText = 'color: rgba(255, 255, 255, 0.9); font-size: 12px; font-family: monospace;';

            const titleText = doc.createElement('span');
            titleText.textContent = emote.title || '(no title)';
            titleText.style.cssText = 'color: rgba(255, 255, 255, 0.6); font-size: 11px;';

            info.appendChild(code);
            info.appendChild(titleText);

            const editBtn = createStyledButton(doc, 'Edit', 'info');
            editBtn.style.padding = '4px 12px';
            editBtn.style.fontSize = '11px';
            addManagedEventListener(editBtn, 'click', () => { manager.remove(); showEmoteEditor(doc, emote, index); });

            const deleteBtn = createStyledButton(doc, 'Delete', 'danger');
            deleteBtn.style.padding = '4px 12px';
            deleteBtn.style.fontSize = '11px';
            addManagedEventListener(deleteBtn, 'click', () => {
                if (confirm(`Delete emote "${emote.code}"?`)) {
                    const updatedEmotes = currentEmotes.filter((_, i) => i !== index);
                    storage.saveEmotes(updatedEmotes);
                    manager.remove();
                    showEmoteManager(doc);
                    if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
                }
            });

            if (preview) item.appendChild(preview);
            item.appendChild(info);
            item.appendChild(editBtn);
            item.appendChild(deleteBtn);
            list.appendChild(item);
        });

        manager.appendChild(list);

        // Utility buttons
        const utilityContainer = doc.createElement('div');
        utilityContainer.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';

        const exportBtn = createStyledButton(doc, 'Export', 'neutral', { flex: true });
        addManagedEventListener(exportBtn, 'click', (e) => { e.preventDefault(); e.stopPropagation(); showExportDialog(doc, currentEmotes); });

        const importBtn = createStyledButton(doc, 'Import', 'neutral', { flex: true });
        addManagedEventListener(importBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = doc.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            addManagedEventListener(input, 'change', (ev) => {
                const file = ev.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        try {
                            const imported = JSON.parse(re.target.result);
                            if (Array.isArray(imported)) {
                                storage.saveEmotes(imported);
                                manager.remove();
                                showEmoteManager(doc);
                                if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
                            } else {
                                alert('Invalid emotes file format');
                            }
                        } catch (err) {
                            alert('Error parsing emotes file: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                }
            });
            input.click();
        });

        const resetBtn = createStyledButton(doc, 'Reset to Default', 'warning', { flex: true });
        addManagedEventListener(resetBtn, 'click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm('Reset all emotes to default? This will delete your custom emotes.')) {
                storage.resetEmotesToDefault();
                manager.remove();
                showEmoteManager(doc);
                if (SNEED.ui.reloadEmoteBar) SNEED.ui.reloadEmoteBar(doc);
            }
        });

        utilityContainer.appendChild(exportBtn);
        utilityContainer.appendChild(importBtn);
        utilityContainer.appendChild(resetBtn);
        manager.appendChild(utilityContainer);

        const closeBtn = createStyledButton(doc, 'Close', 'secondary', { fullWidth: true });
        addManagedEventListener(closeBtn, 'click', () => { manager.remove(); removeElementListeners(manager); });
        manager.appendChild(closeBtn);

        doc.body.appendChild(manager);
        setupClickOutside(doc, manager);
    }

    // ============================================
    // EXPORT TO NAMESPACE
    // ============================================

    SNEED.ui.showBlacklistManager = showBlacklistManager;
    SNEED.ui.showEmoteManager = showEmoteManager;
    SNEED.ui.showEmoteEditor = showEmoteEditor;
    SNEED.ui.showExportDialog = showExportDialog;

})();
