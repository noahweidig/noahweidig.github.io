/* ---------------------------------------------------------- contact form -- */
import { on } from './dom';

export function initContactForm() {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const wrap = form.querySelector<HTMLElement>('[data-send-wrap]');
  const face = wrap?.querySelector<HTMLElement>('.confirm-face');
  const done = wrap?.querySelector<HTMLElement>('[data-send-done]');
  const redo = wrap?.querySelector<HTMLElement>('[data-send-redo]');
  const started = form.querySelector<HTMLInputElement>('input[name="nw-form-started"]');
  if (started) started.value = String(Date.now());

  const say = (msg: string, ok: boolean) => {
    if (!status) return;
    status.textContent = msg;
    status.dataset.state = ok ? 'ok' : 'error';
  };

  const show = (sent: boolean) => {
    if (!wrap || !face || !done) return;
    wrap.dataset.state = sent ? 'sent' : '';
    face.inert = sent;
    done.inert = !sent;
  };
  if (redo)
    on(redo, 'click', () => {
      show(false);
      form.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    });

  on(form, 'submit', async (ev) => {
    ev.preventDefault();
    if (started && Date.now() - Number(started.value) < 1500) {
      say('That was quick. Give it a moment and try again.', false);
      return;
    }
    submit?.setAttribute('disabled', '');
    form.dataset.sending = 'true';
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        form.reset();
        if (started) started.value = String(Date.now());
        say('', true);
        show(true);
        setTimeout(() => redo?.focus(), 350);
      } else {
        say('That did not send. Email noah@noahweidig.com directly and it will reach me.', false);
      }
    } catch {
      say('Network trouble. Email noah@noahweidig.com directly and it will reach me.', false);
    } finally {
      submit?.removeAttribute('disabled');
      delete form.dataset.sending;
    }
  });
}
