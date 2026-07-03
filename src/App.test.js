import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

test('ヘッダーと検索フォームが表示される', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>
  );
  expect(screen.getByText('Gundam War Database')).toBeInTheDocument();
  expect(screen.getByText('カード名')).toBeInTheDocument();
});
