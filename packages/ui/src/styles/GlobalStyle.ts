import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Source+Sans+3:wght@400;500;600;700&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
  }

  html, body, #root {
    width: 100%;
    min-height: 100%;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: ${({ theme }) => theme.font.familySans};
    background: radial-gradient(circle at top right, #dceee9 0%, ${({ theme }) => theme.color.bg} 38%, #f8fbfa 100%);
    color: ${({ theme }) => theme.color.text};
    line-height: 1.5;
    text-rendering: optimizeLegibility;
  }

  a {
    color: inherit;
  }

  :focus-visible {
    outline: 3px solid ${({ theme }) => theme.color.focus};
    outline-offset: 2px;
    border-radius: ${({ theme }) => theme.radius.sm};
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
