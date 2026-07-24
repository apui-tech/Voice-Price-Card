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

-- Tạo bảng lưu trữ cấu hình hệ thống và mã PIN đăng nhập
create table if not exists public.app_config (
  key text primary key,
  value text
);

-- Bật tính năng Row Level Security
alter table public.app_config enable row level security;

-- Cho phép tất cả mọi người đọc cấu hình công khai
create policy "Cho phép đọc cấu hình công khai" on public.app_config for select using (true);

-- Cho phép tất cả mọi người sửa cấu hình (để admin cập nhật PIN / API keys từ client)
create policy "Cho phép sửa cấu hình công khai" on public.app_config for insert with check (true);
create policy "Cho phép cập nhật cấu hình công khai" on public.app_config for update using (true);
create policy "Cho phép xóa cấu hình công khai" on public.app_config for delete using (true);

