// Reproduce the original TasteNet styles without allowing one page's CSS to leak
// into another role. Run with the read-only source checkout at .reference/TasteNet.
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const source = path.resolve('../.reference/TasteNet');
const output = path.resolve('src/original');
const pages = {
  login: 'Login.aspx', register: 'Register.aspx', landing: 'LandingPage.aspx',
  customer: 'Users/Customer/CustomerPortal.aspx',
  shell: 'MasterPages/Admin.Master', 'super-shell': 'MasterPages/SuperAdmin.Master',
  'rider-shell': 'MasterPages/Rider.Master',
  inventory: 'Users/Admin/Inventory.aspx', menu: 'Users/Admin/Menu.aspx',
  tickets: 'Users/Admin/Ticketing.aspx', history: 'Users/Admin/OrderHistory.aspx',
  dashboard: 'Users/SuperAdmin/Dashboard.aspx', customers: 'Users/SuperAdmin/CustomerManagement.aspx',
  personnel: 'Users/SuperAdmin/DeliveryPersonnel.aspx', reports: 'Users/SuperAdmin/Reports.aspx',
  transactions: 'Users/SuperAdmin/Transactions.aspx', recipes: 'Users/SuperAdmin/RecipeManager.aspx',
  settings: 'Users/SuperAdmin/Settings.aspx', rider: 'Users/Rider/Dashboard.aspx',
  'rider-history': 'Users/Rider/DeliveryHistory.aspx', 'rider-profile': 'Users/Rider/Profile.aspx'
};
fs.mkdirSync(output, { recursive: true });
for (const [name, file] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(source, file), 'utf8');
  let css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join('\n');
  css = css.replace(/<%=?[\s\S]*?ResolveUrl\(["']~\/([^"']+)["']\)[\s\S]*?%>/g, '/$1')
    .replace(/<%[\s\S]*?%>/g, 'legacy-unused')
    .replace(/url\(\s*(["']?)(?:\.\.\/)*(?:\/)?Images\//gi, 'url($1/images/')
    .replace(/\/images\//gi, '/original-assets/');
  const root = postcss.parse(css, { from: file });
  const scope = `.original-${name}`;
  const animations = new Map();
  root.walkAtRules(/keyframes$/, rule => {
    animations.set(rule.params, `${name}-${rule.params}`);
    rule.params = `${name}-${rule.params}`;
  });
  root.walkDecls(/^(animation|animation-name)$/, decl => {
    for (const [before, after] of animations) decl.value = decl.value.replace(new RegExp(`\\b${before}\\b`, 'g'), after);
  });
  root.walkRules(rule => {
    let ancestor = rule.parent;
    while (ancestor) {
      if (ancestor.type === 'atrule' && /keyframes$/.test(ancestor.name)) return;
      ancestor = ancestor.parent;
    }
    rule.selectors = rule.selectors.map(selector => {
      selector = selector.replace(/#form1\b/g, '.original-form');
      if (/^(?:html|body|form|:root)\b/.test(selector) || selector.startsWith(':root')) {
        // The WebForms source has one outer form. React has small forms inside
        // cards and dialogs; outer-form sizing must stay on the page root.
        return selector.replace(/^(?:(?:html|body|form|:root)(?:\s+|\s*>\s*)?)+/, match => scope + (/\s$/.test(match) ? ' ' : '')).trim();
      }
      return `${scope} ${selector}`;
    });
  });
  root.walkComments(comment => comment.remove());
  fs.writeFileSync(path.join(output, `${name}.css`), `/* Ported from Jeyarrr/TasteNet ${file}, commit a7ba463. */\n${root.toString()}\n`);
}
console.log(`Imported ${Object.keys(pages).length} original page styles.`);

// Only copy the static, public website sections. Dynamic ASP.NET controls and
// source JavaScript are replaced by React and the PERN API.
const portal = fs.readFileSync(path.join(source, pages.customer), 'utf8');
const clean = html => html.replace(/<%--[\s\S]*?--%>/g, '')
  .replace(/<%=\s*ResolveUrl\(["']~\/Images\/([^"']+)["']\)\s*%>/g, '/original-assets/$1')
  .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
  .replace(/section-fade-in/g, 'section-fade-in visible');
const sections = {};
for (const [key, pattern] of Object.entries({
  about: /<section id="about"[\s\S]*?<\/section>/,
  love: /<section class="love-us-section[\s\S]*?<\/section>/,
  steps: /<section class="compact-order-steps[\s\S]*?<\/section>/,
  contact: /<section id="contact"[\s\S]*?<\/section>/,
  footer: /<footer class="main-footer[\s\S]*?<\/footer>/
})) {
  const match = portal.match(pattern);
  if (!match) throw new Error(`Missing original section: ${key}`);
  sections[key] = clean(match[0]);
}
fs.writeFileSync(path.join(output, 'website-sections.json'), JSON.stringify(sections, null, 2));
