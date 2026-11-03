import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TagPicker } from './TagPicker'

afterEach(cleanup)
const options = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, name: i === 0 ? 'Điện toán' : `Tag ${i}` }))

it('finds tags without diacritics and toggles them', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  render(<TagPicker language="vi" options={options} selected={[]} onChange={onChange} />)
  await user.type(screen.getByRole('searchbox', { name: 'Tìm thẻ' }), 'dien')
  expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  await user.click(screen.getByRole('checkbox', { name: 'Điện toán' }))
  expect(onChange).toHaveBeenCalledWith(['t0'])
})

it('blocks an 11th tag and removes a chip by its labelled button', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  const ten = options.slice(0, 10).map(o => o.id)
  render(<TagPicker language="en" options={options} selected={ten} onChange={onChange} />)
  expect(screen.getByText('10/10')).toBeTruthy()
  expect((screen.getByRole('checkbox', { name: 'Tag 11' }) as HTMLButtonElement).disabled).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Remove tag Tag 1' }))
  expect(onChange).toHaveBeenCalledWith(ten.filter(id => id !== 't1'))
})
