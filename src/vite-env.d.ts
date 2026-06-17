/// <reference types="vite/client" />

declare module 'virtual:windi-css' {
  export const classes: string;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}
