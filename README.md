# Template Extensions

The goal of this library is to easily create HTML templates with dynamic parts
which is covered by the API's based on the
[Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md)
and [DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)
proposals.

## AssignedTemplateInstance (naming could change)

```js
const templateInstance = new AssignedTemplateInstance(container, template, state, processor);
templateInstance.update(state); // later on
```

In addition it adds new API's to enhance existing elements with these dynamic parts.
This allows you to write something like the example below to hydrate SSR / SSG.

```html
  <script type="module">
    import { render, enhance, html } from './dist/interhtml.js';

    const run = (props) => {
      console.time('enhance');
      enhance(getTemplate(props), window.container);
      console.timeEnd('enhance');
    }
    run({ count: 7 });

    function getTemplate({ count, disabled = false }) {
      return html`
        <div>
          <h1 class="${'headline' + count}">Counter</h1>
          <p> ${count}${ count } <br> left in ${count}°C${count} <br>   ${count}</p>
          lala
          ${count > 7 ? html`<div>higher baby</div>` : html`<div>${count} on the nose</div>`}
          lala
          lala
          <div>
            <button disabled="${disabled}" onclick="${() => run({ count: count+1 })}">+</button>
            <button onclick="${() => run({ count: count-1 })}">-</button>
          </div>
          ${[1, 2].map((i) => {
            return html`<div class="c${i + count - 7}t${count}">${i + count}</div>`;
          })}
        </div>
        ${count}
      `;
    }
  </script>

  <div id="container">
    <div>
      <h1 class="headline7">Counter</h1>
      <p> 77 <br> left in 7°C7 <br>   7</p>
      lala
      <div>7 on the nose</div>
      lala
      lala
      <div>
        <button>+</button>
        <button>-</button>
      </div>
      <div class="c1t7">8</div>
      <div class="c2t7">9</div>
    </div>
    7
  </div>
```

## Credit

The template instance and DOM parts code is based on the great work of 
[Dmitry Iv.](https://github.com/dy) and [Keith Cirkel](https://github.com/keithamus).

- https://github.com/dy/template-parts
- https://github.com/github/template-parts
- https://github.com/github/jtml
