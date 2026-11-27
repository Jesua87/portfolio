const $ = (selector) => document.querySelector(selector);
const make = (tag, classes, content) => {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (content != null) node.textContent = content;
  return node;
};

let portfolio;
let filter = '';
let editing;
let busy = false;
const detail = $('#detail');
const editor = $('#editor');
const profileDialog = $('#profile');
const projectForm = $('#project-form');
const profileForm = $('#profile-form');

for (const dialog of document.querySelectorAll('dialog')) {
  const title = dialog.querySelector('h2');
  const titleId = title?.id || dialog.id + '-heading';
  if (title) title.id = titleId;
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
}
const draftMode = new URLSearchParams(location.search).get('redigera') === '1';
let hasUnexportedChanges = false;

if (draftMode) {
  $('#draft').hidden = false;
  const githubUpload = $('#open-github-upload');
  const account = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i)?.[1];
  const repo = location.pathname.split('/').filter(Boolean)[0] || location.hostname;
  if (account && /^[a-z0-9_.-]+$/i.test(repo)) {
    githubUpload.href = 'https://github.com/' + account + '/' + repo + '/upload/main';
    githubUpload.hidden = false;
  }
  $('#download-draft').addEventListener('click', () => {
    if (!portfolio) return;
    const {profile, projects} = portfolio;
    const json = JSON.stringify({profile, projects}, null, 2) + '\n';
    const url = URL.createObjectURL(new Blob([json], {type:'application/json'}));
    const link = make('a');
    link.href = url;
    link.download = 'portfolio.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    hasUnexportedChanges = false;
    $('#draft-status').textContent = 'Ladda upp filen med exakt namnet portfolio.json i arkivets rot och spara ändringen på GitHub.';
  });
  addEventListener('beforeunload', event => {
    if (hasUnexportedChanges) event.preventDefault();
  });
}

function imageData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), {once:true});
    reader.addEventListener('error', () => reject(new Error('Bilden kunde inte läsas.')), {once:true});
    reader.readAsDataURL(file);
  });
}

async function api(path, options) {
  if (!options) {
    const response = await fetch('./portfolio.json', {cache:'no-cache'});
    if (!response.ok) throw new Error('Portfolion kunde inte laddas. Försök igen.');
    const data = await response.json();
    return {...data, canEdit:draftMode};
  }
  if (!draftMode) throw new Error('Öppna redigeringsvyn för att ändra innehållet.');
  const {method, body} = options;
  const next = {...portfolio};
  if (path === '/api/profile') {
    const profile = Object.fromEntries([...body].map(([key,value]) => [key,value.trim()]));
    if (!profile.intro || !profile.bio) throw new Error('Fyll i en introduktion och en kort presentation.');
    next.profile = profile;
  } else {
    const id = path === '/api/projects' ? null : path.split('/').at(-1);
    const prior = id && portfolio.projects.find(project => project.id === id);
    if (method === 'DELETE') {
      next.projects = portfolio.projects.filter(project => project.id !== id);
    } else {
      const fields = Object.fromEntries([...body].filter(([key]) => key !== 'image').map(([key,value]) => [key,value.trim()]));
      if (!fields.title || !fields.category || !fields.summary) throw new Error('Fyll i titel, kategori och kort beskrivning.');
      if (fields.url && !['http:', 'https:'].includes(new URL(fields.url).protocol)) {
        throw new Error('Projektlänken behöver börja med https:// eller http://.');
      }
      const file = body.get('image');
      const image = file ? await imageData(file) : (prior?.image || '');
      const project = {...fields, id:id || crypto.randomUUID(), year:Number(fields.year), image, demo:false};
      next.projects = id ? portfolio.projects.map(item => item.id === id ? project : item) : [project,...portfolio.projects];
    }
  }
  hasUnexportedChanges = true;
  $('#draft-status').textContent = 'Ändringen finns i ditt utkast. Ladda ned filen för att publicera ändringen via GitHub.';
  return next;
}
function art(project, large = false) {
  const box = make('div', 'art' + (large ? ' detail-art' : '') + (project.image ? '' : ' empty'));
  if (project.image) {
    const image = make('img');
    image.alt = '';
    image.src = project.image;
    if (!large) image.loading = 'lazy';
    box.append(image);
  } else {
    box.textContent = [...project.title][0].toUpperCase();
    box.setAttribute('aria-hidden', 'true');
  }
  return box;
}
function openDetail(project) {
  const target = $('#detail-content');
  const label = make('p', 'eyebrow');
  label.append(make('span', 'dash'), project.category + ' · ' + project.year + (project.demo ? ' · Exempelprojekt' : ''));
  const title = make('h2', '', project.title);
  title.id = 'detail-heading';
  const intro = make('p', '', project.summary);
  target.replaceChildren(label, title, art(project, true), intro);
  if (project.role) {
    const role = make('p', 'detail-role');
    role.append(make('strong', '', 'Roll'), ' · ', project.role);
    target.append(role);
  }
  if (project.story) target.append(make('p', 'detail-text', project.story));
  const actions = make('div', 'form-actions');
  if (project.url) {
    const link = make('a', 'button primary', 'Besök projektet');
    link.href = project.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    actions.append(link);
  }
  if (portfolio.canEdit) {
    const edit = make('button', 'button outline', 'Redigera projekt');
    edit.addEventListener('click', () => { detail.close(); openEditor(project); });
    actions.append(edit);
  }
  if (actions.childElementCount) target.append(actions);
  detail.showModal();
}
function renderProjects(focusFilter = false) {
  const categories = [...new Set(portfolio.projects.map(project => project.category))];
  if (filter && !categories.includes(filter)) filter = '';
  $('#categories').replaceChildren(...categories.map(value => Object.assign(make('option'), {value})));
  const filters = ['', ...categories].map(category => {
    const button = make('button', 'filter', category || 'Alla');
    button.setAttribute('aria-pressed', String(filter === category));
    button.addEventListener('click', () => { filter = category; renderProjects(true); });
    return button;
  });
  $('#filters').replaceChildren(...filters);
  $('#filters').hidden = !portfolio.projects.length;
  if (focusFilter) filters.find(button => button.getAttribute('aria-pressed') === 'true')?.focus();

  const projects = portfolio.projects.filter(project => !filter || filter === project.category);
  $('#project-count').textContent = projects.length + ' projekt';
  const cards = projects.map(project => {
    const card = make('article', 'card');
    const button = make('button', 'card-button');
    button.addEventListener('click', () => openDetail(project));
    const body = make('div', 'card-body');
    const meta = make('div', 'meta');
    meta.append(make('span', '', project.category), make('span', '', project.demo ? 'Exempel · ' + project.year : String(project.year)));
    body.append(meta, make('h3', '', project.title), make('p', '', project.summary));
    button.append(art(project), body);
    card.append(button);
    return card;
  });
  $('#project-grid').replaceChildren(...cards);
  $('#status').hidden = Boolean(cards.length);
  $('#status').textContent = 'Här visas dina projekt när du har lagt till dem.';

  const positions = [[28,45],[49,23],[69,55],[45,71],[65,32],[34,66]];
  const pins = portfolio.projects.slice(0, positions.length).map((project, index) => {
    const pin = make('button', 'pin');
    pin.setAttribute('aria-label', 'Öppna ' + project.title);
    const sign = make('span', '', '+');
    sign.setAttribute('aria-hidden', 'true');
    pin.append(sign, make('span', 'pin-label', project.title));
    const [x, y] = positions[index];
    pin.style.left = x + '%';
    pin.style.top = y + '%';
    pin.addEventListener('click', () => openDetail(project));
    return pin;
  });
  $('#map-pins').replaceChildren(...pins);
  $('#map-hint').textContent = pins.length ? 'Välj en punkt för att öppna ett projekt' : 'Dina senaste projekt visas här';
}
function render() {
  const {profile, canEdit} = portfolio;
  $('.add').hidden = !canEdit;
  $('#edit-profile').hidden = !canEdit;
  $('#intro').textContent = profile.intro;
  $('#about-title').textContent = profile.name ? 'Om ' + profile.name : 'Om portfolion';
  $('#bio').textContent = profile.bio;
  $('#contact').hidden = !profile.email;
  if (profile.email) $('#contact').href = 'mailto:' + profile.email;
  document.title = profile.name ? profile.name + ' · Portfolio' : 'Forma · Portfolio';
  renderProjects();
}
function showError(form, message = '') {
  const error = form.querySelector('.form-error');
  error.textContent = message;
  error.hidden = !message;
}
function openEditor(project) {
  editing = project;
  projectForm.reset();
  showError(projectForm);
  $('#editor-title').textContent = project ? 'Redigera projekt' : 'Lägg till projekt';
  $('#remove-project').hidden = !project;
  $('#image-note').textContent = project?.image ? 'Den nuvarande bilden sparas om du lämnar fältet tomt.' : 'JPG, PNG, WebP eller AVIF. Valfritt.';
  const values = project || {year: new Date().getFullYear()};
  for (const name of ['title','category','year','role','summary','story','url']) {
    projectForm.elements.namedItem(name).value = values[name] ?? '';
  }
  editor.showModal();
}
async function runForm(form, dialog, action) {
  if (busy) return;
  busy = true;
  const buttons = [...form.querySelectorAll('button')];
  buttons.forEach(button => button.disabled = true);
  showError(form);
  try {
    portfolio = await action();
    filter = '';
    render();
    dialog.close();
  } catch (error) {
    showError(form, error.message);
  } finally {
    busy = false;
    buttons.forEach(button => button.disabled = false);
  }
}
async function optimizeImage(file) {
  if (!file.size) return null;
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 30_000_000) {
    throw new Error('Välj en JPG-, PNG-, WebP- eller AVIF-bild på högst 30 MB.');
  }
  let image;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error('Bilden kunde inte läsas. Prova en annan bild.');
  }
  const resize = Math.min(1, 1400 / Math.max(image.width, image.height));
  const canvas = make('canvas');
  canvas.width = Math.max(1, Math.round(image.width * resize));
  canvas.height = Math.max(1, Math.round(image.height * resize));
  const context = canvas.getContext('2d');
  context.fillStyle = '#171613';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .83));
  if (!blob) throw new Error('Bilden kunde inte sparas.');
  return blob;
}
$('.add').addEventListener('click', () => openEditor());
projectForm.addEventListener('submit', event => {
  event.preventDefault();
  const id = editing?.id;
  const body = new FormData(projectForm);
  runForm(projectForm, editor, async () => {
    const image = await optimizeImage(body.get('image'));
    body.delete('image');
    if (image) body.append('image', image, 'projekt.jpg');
    return api('/api/projects' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', body });
  });
});
$('#remove-project').addEventListener('click', () => {
  if (busy || !editing || !confirm('Ta bort projektet ”' + editing.title + '” från portfolion?')) return;
  const id = editing.id;
  runForm(projectForm, editor, () => api('/api/projects/' + id, {method:'DELETE'}));
});
$('#edit-profile').addEventListener('click', () => {
  showError(profileForm);
  for (const name of ['name','intro','bio','email']) {
    profileForm.elements.namedItem(name).value = portfolio.profile[name];
  }
  profileDialog.showModal();
});
profileForm.addEventListener('submit', event => {
  event.preventDefault();
  const body = new FormData(profileForm);
  runForm(profileForm, profileDialog, () => api('/api/profile', {method:'PUT', body}));
});
api('/api/portfolio').then(data => {
  portfolio = data;
  render();
}).catch(error => {
  $('#status').textContent = error.message;
  $('#status').hidden = false;
});

const map = $('.map-visual');
const canvas = $('#orbit');
const ctx = canvas.getContext('2d');
const image = new Image();
image.onload = () => { map.classList.add('has-image'); draw(0); };
image.src = './assets/orbit.webp';
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let aim = 0;
let rotation = .25;
const paths = Array.from({length: 40}, (_, index) => {
  const azimuth = index * Math.PI * 2 / 40;
  return Array.from({length: 121}, (_, step) => {
    const t = step * Math.PI * 2 / 120;
    const angle = azimuth + t * 2;
    const radius = 1 + .39 * Math.cos(angle);
    return [Math.cos(t) * radius, Math.sin(t) * radius, .39 * Math.sin(angle)];
  });
});
function draw(time) {
  const {width, height} = map.getBoundingClientRect();
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
    canvas.width = Math.round(width*dpr);
    canvas.height = Math.round(height*dpr);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  const hasArtwork = map.classList.contains('has-image');
  if (hasArtwork && Math.abs(aim) < .015 && Math.abs(rotation - .25) < .015) return;
  const scale = Math.min(width * .33, height * .39);
  const theta = rotation + (motion.matches ? 0 : Math.sin(time / 2400) * .042);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  for (const [index, path] of paths.entries()) {
    ctx.beginPath();
    path.forEach(([x,y,z], step) => {
      const a = x*cos + z*sin;
      const b = y*.65 - (z*cos-x*sin)*.77;
      const px = width*.51 + a*scale;
      const py = height*.51 + b*scale;
      if (step === 0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.strokeStyle = index % 6 === 0 ? '#ffbf9eaf' : '#ff79484a';
    ctx.lineWidth = index % 6 === 0 ? .9 : .6;
    ctx.stroke();
  }
}
let frame = 0;
function animate(time) {
  rotation += (.25 + aim - rotation) * .08;
  draw(time);
  if (!motion.matches && Math.abs(.25 + aim - rotation) > .003) {
    frame = requestAnimationFrame(animate);
  } else {
    frame = 0;
  }
}
map.addEventListener('pointermove', event => {
  if (motion.matches || event.pointerType === 'touch') return;
  const bounds = map.getBoundingClientRect();
  aim = ((event.clientX - bounds.left) / bounds.width - .5) * .88;
  if (!frame) frame = requestAnimationFrame(animate);
});
map.addEventListener('pointerleave', () => {
  aim = 0;
  if (!frame) frame = requestAnimationFrame(animate);
});
new ResizeObserver(() => draw(0)).observe(map);
