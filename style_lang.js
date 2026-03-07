import fs from 'fs';

let css = fs.readFileSync('src/App.css', 'utf-8');

if (!css.includes('.lang-select')) {
    css = css.replace(
        /\.header-right \{[\s\S]*?\}/,
        `.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lang-select {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-family: inherit;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lang-select:hover {
  background: rgba(34, 211, 238, 0.1);
  border-color: rgba(34, 211, 238, 0.3);
  color: #fff;
}

.lang-select option {
  background: #020617;
  color: #fff;
}`
    );
    fs.writeFileSync('src/App.css', css);
}

// Cleanup scripts
fs.unlinkSync('update_jsx.js');
fs.unlinkSync('update_i18n.js');
fs.unlinkSync('update_css.js');
fs.unlinkSync('update_style.js');
