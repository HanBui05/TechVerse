export const APP_NAME = "TechVerse";
export const PAGE_SIZE = 6;
export const formatDate = (value: string) => new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
export const formatPrice = (amount: number) => amount === 0 ? "Miễn phí" : `${new Intl.NumberFormat("vi-VN").format(amount)} VND`;
