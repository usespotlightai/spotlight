import type { ConnectBridge } from '../bridges';
import { element } from './element.js';

declare global {
  interface Window {
    readonly spotlightConnect: ConnectBridge;
  }
}

const bridge = window.spotlightConnect;
const form = element('form', HTMLFormElement);
const input = element('address', HTMLInputElement);
const error = element('error', HTMLElement);

const sizeToCard = () =>
  bridge.fit(Math.ceil(form.getBoundingClientRect().height));

const said = (message: string) => {
  error.textContent = message;
  sizeToCard();
};

document.body.addEventListener('mousedown', (event) => {
  if (!(event.target instanceof Node && form.contains(event.target))) {
    bridge.cancel();
  }
});

void bridge.current().then(async (address) => {
  input.value = address;
  await document.fonts.ready;
  sizeToCard();
  input.focus();
  input.select();
});

input.addEventListener('input', () => {
  if (error.textContent) {
    said('');
  }
});

element('cancel', HTMLButtonElement).addEventListener('click', () =>
  bridge.cancel(),
);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    bridge.cancel();
  }
});

const save = async () => {
  if (!(await bridge.save(input.value))) {
    said('The address must use https, such as https://spotlight.example.com.');
  }
};

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void save();
});
