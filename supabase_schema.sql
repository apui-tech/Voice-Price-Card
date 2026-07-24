-- Tạo bảng lưu trữ danh sách thẻ giá sản phẩm
create table if not exists public.items (
  id text primary key,
  name text not null,
  price numeric not null,
  category text default 'rau',
  unit text default 'kg',
  image text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  keywords text[]
);

-- Cho phép tất cả người dùng xem, thêm, sửa, xóa (Row Level Security)
alter table public.items enable row level security;

create policy "Cho phép đọc dữ liệu công khai" on public.items for select using (true);
create policy "Cho phép thêm sản phẩm công khai" on public.items for insert with check (true);
create policy "Cho phép sửa giá công khai" on public.items for update using (true);
create policy "Cho phép xóa sản phẩm công khai" on public.items for delete using (true);

-- Kích hoạt tính năng Realtime đồng bộ giữa điện thoại Mẹ & Bố
alter publication supabase_realtime add table public.items;
