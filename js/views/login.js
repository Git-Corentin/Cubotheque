import { state, signIn, signOut, resetPassword, setPassword } from '../store.js';
import { h, toast } from '../ui.js';

export function render(main, params) {
  const box = h('section', { class: 'login panel' });
  main.append(h('header', { class: 'head' }, h('h1', {}, 'Espace propriétaire')), box);

  if (state.backend !== 'supabase') {
    box.append(
      h('p', {}, 'La base en ligne n\'est pas encore branchée : pour l\'instant, la collection est enregistrée dans ce navigateur et seul cet appareil peut la modifier.'),
      h('p', {}, 'Pour retrouver la collection sur l\'ordinateur et le téléphone, avec un compte administrateur, suivez l\'assistant dans les réglages.'),
      h('div', { class: 'row' }, h('a', { class: 'btn solid', href: '#/reglages' }, 'Ouvrir les réglages')));
    return;
  }

  if (params.arg === 'nouveau') {
    const pw = h('input', { class: 'field', type: 'password', minlength: 8, autocomplete: 'new-password', required: true });
    box.append(h('form', {
      class: 'login-form', onsubmit: async (e) => {
        e.preventDefault();
        try { await setPassword(pw.value); toast('Mot de passe enregistré.'); location.hash = '#/'; } catch (er) { toast(er.message, 'err'); }
      },
    }, h('p', {}, 'Choisissez votre nouveau mot de passe.'), h('label', { class: 'lbl' }, 'Nouveau mot de passe (8 caractères minimum)', pw), h('button', { class: 'btn accent' }, 'Enregistrer le mot de passe')));
    return;
  }

  if (state.user) {
    box.append(
      h('p', {}, 'Connecté avec ', h('b', {}, state.user.email), '.'),
      state.canEdit
        ? h('p', {}, 'Ce compte peut modifier la collection, les méthodes et les réglages, depuis n\'importe quel appareil.')
        : h('p', { class: 'err' }, 'Ce compte n\'est pas administrateur : il ne peut rien modifier. Ajoutez-le à la table admins (voir le guide d\'installation).'),
      h('div', { class: 'row' },
        state.canEdit ? h('a', { class: 'btn accent', href: '#/ajouter' }, 'Ajouter un casse-tête') : null,
        h('button', { class: 'btn', onclick: async () => { await signOut(); toast('Déconnecté.'); location.hash = '#/'; } }, 'Se déconnecter')));
    return;
  }

  const email = h('input', { class: 'field', type: 'email', autocomplete: 'username', required: true });
  const pw = h('input', { class: 'field', type: 'password', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'btn accent', type: 'submit' }, 'Se connecter');
  box.append(
    h('p', { class: 'muted' }, 'Les visiteurs consultent la collection librement. La modification est réservée au compte administrateur.'),
    h('form', {
      class: 'login-form', onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; btn.textContent = 'Connexion…';
        try {
          const ok = await signIn(email.value.trim(), pw.value);
          toast(ok ? 'Connecté. Vous pouvez modifier la collection.' : 'Connecté, mais ce compte n\'a pas les droits d\'édition.', ok ? '' : 'err');
          location.hash = '#/';
        } catch (er) { toast(er.message, 'err'); btn.disabled = false; btn.textContent = 'Se connecter'; }
      },
    },
    h('label', { class: 'lbl' }, 'Adresse e-mail', email),
    h('label', { class: 'lbl' }, 'Mot de passe', pw),
    h('div', { class: 'row' }, btn,
      h('button', {
        class: 'btn ghost', type: 'button', onclick: async () => {
          if (!email.value) { email.focus(); toast('Indiquez d\'abord votre adresse.', 'err'); return; }
          try { await resetPassword(email.value.trim()); toast('Un lien de réinitialisation a été envoyé.'); } catch (er) { toast(er.message, 'err'); }
        },
      }, 'Mot de passe oublié'))));
  email.focus();
}
