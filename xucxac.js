// ===== XÚC XẮC COMPONENT =====
class XucXac extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._value = 1;
  }

  static get observedAttributes() {
    return ['value', 'rolling'];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'value') {
      this._value = parseInt(newVal) || 1;
      this.render();
    } else if (name === 'rolling') {
      if (newVal === 'true') {
        this.shadowRoot.querySelector('.xuc-xac').classList.add('rolling');
      } else {
        this.shadowRoot.querySelector('.xuc-xac').classList.remove('rolling');
      }
    }
  }

  render() {
    const cssURL = 'xucxac.css';
    const faceClass = `face-${this._value}`;
    const pipCount = this._value;
    let pipsHTML = '';
    for (let i = 0; i < pipCount; i++) {
      // Mặt 1 dùng chấm đỏ to
      const redClass = (this._value === 1) ? ' red' : '';
      pipsHTML += `<div class="pip${redClass}"></div>`;
    }

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="${cssURL}">
      <div class="xuc-xac">
        <div class="face ${faceClass}">
          ${pipsHTML}
        </div>
      </div>
    `;
  }
}

customElements.define('xuc-xac', XucXac);