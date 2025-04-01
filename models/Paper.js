class Paper {
    constructor(TenBaiBao, TenNhomTacGia, ISBN, SoTrang, NamXuatBan) {
        this.TenBaiBao = TenBaiBao;
        this.TenNhomTacGia = TenNhomTacGia;
        this.ISBN = ISBN;
        this.SoTrang = parseInt(SoTrang);
        this.NamXuatBan = parseInt(NamXuatBan);
    }
}

module.exports = Paper;
