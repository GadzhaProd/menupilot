# MenuPilot

MenuPilot is a small browser app for recipe-based ingredient costing and what-if contribution scenarios for independent restaurants. It is a work in progress.

## Run locally

Requires Node.js 20 or newer. The project has no dependencies or build step.

```sh
npm start
npm test
```

Money input accepts a decimal comma or point and rejects thousands separators.

See [planning documents](docs/planning/) for the approved architecture and implementation plan.

## Acknowledgements

Ideas about base units, yield, and cost excluding VAT were inspired by [kitchen-costing-for-claude-code](https://github.com/Enterprise-DNA-OS/kitchen-costing-for-claude-code), MIT licensed, by Enterprise DNA. No code was copied.
