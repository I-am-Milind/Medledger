import styled from 'styled-components';

export const AppFrame = styled.div`
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
`;

export const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid ${({ theme }) => theme.color.border};
`;

export const TopBarInner = styled.div`
  width: min(1200px, calc(100% - 2rem));
  margin: 0 auto;
  padding: ${({ theme }) => `${theme.spacing.md} 0`};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: ${({ theme }) => theme.breakpoints.tablet}px) {
    flex-wrap: wrap;
  }
`;
