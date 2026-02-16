import styled, { css } from 'styled-components';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  variant?: ButtonVariant;
};

const variantStyles = {
  primary: css`
    background: ${({ theme }) => theme.color.primary};
    color: #ffffff;
    border: 1px solid ${({ theme }) => theme.color.primary};

    &:hover {
      background: ${({ theme }) => theme.color.primaryHover};
      border-color: ${({ theme }) => theme.color.primaryHover};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.color.surface};
    color: ${({ theme }) => theme.color.text};
    border: 1px solid ${({ theme }) => theme.color.border};

    &:hover {
      background: ${({ theme }) => theme.color.surfaceMuted};
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.color.danger};
    color: #ffffff;
    border: 1px solid ${({ theme }) => theme.color.danger};

    &:hover {
      filter: brightness(0.94);
    }
  `,
};

export const Button = styled.button<ButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;

  ${({ variant = 'primary' }) => variantStyles[variant]}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
