export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { username, password } = req.body;

    // KONFIGURASI REPOSITORY GITHUB KAMU (Silakan sesuaikan)
    const GH_OWNER = "USERNAME_GITHUB_KAMU"; 
    const GH_REPO = "NAMA_REPOSITORY_KAMU";
    const ADMIN_PATH = "database/admin.json";
    const USER_PATH = "database/users.json";
    const TOKEN = process.env.GH_TOKEN; // Mengambil token aman dari Vercel

    try {
        // 1. Ambil data admin.json dari GitHub
        const adminRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${ADMIN_PATH}`, {
            headers: { 'Authorization': `token ${TOKEN}` }
        });
        const adminData = await adminRes.json();
        const admins = JSON.parse(Buffer.from(adminData.content, 'base64').toString('utf-8'));

        // Cek apakah yang login adalah Admin
        const isAdmin = admins.find(a => a.username === username && a.password === password);
        if (isAdmin) {
            return res.status(200).json({ status: 'success', role: 'admin' });
        }

        // 2. Ambil data users.json dari GitHub
        const userRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${USER_PATH}`, {
            headers: { 'Authorization': `token ${TOKEN}` }
        });
        const userData = await userRes.json();
        
        // Simpan SHA file lama (Wajib disertakan untuk update file di GitHub API)
        const fileSha = userData.sha; 
        const users = JSON.parse(Buffer.from(userData.content, 'base64').toString('utf-8'));

        // Cek apakah User sudah terdaftar
        const isUser = users.find(u => u.username === username && u.password === password);
        if (isUser) {
            return res.status(200).json({ status: 'success', role: 'user' });
        }

        // Jika username sama tapi password salah
        const userExists = users.find(u => u.username === username);
        if (userExists) {
            return res.status(401).json({ status: 'error', message: 'Kredensial salah / Username sudah terdaftar' });
        }

        // 3. DAFTAR OTOMATIS: Tambah user baru ke dalam array
        const newUser = { username, password, createdAt: new Date().toISOString() };
        users.push(newUser);

        // Convert kembali ke Base64 untuk dikirim ke GitHub
        const updatedContent = Buffer.from(JSON.stringify(users, null, 2)).toString('base64');

        // PUSH / COMMIT OTOMATIS KE GITHUB
        const commitRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${USER_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `system: otomatis menambah user baru [${username}]`,
                content: updatedContent,
                sha: fileSha // SHA file lama agar GitHub tahu ini adalah update
            })
        });

        if (!commitRes.ok) {
            return res.status(500).json({ status: 'error', message: 'Gagal menulis database ke GitHub' });
        }

        return res.status(200).json({ status: 'registered', role: 'user', message: 'Akun baru otomatis terbuat dan tersimpan di GitHub!' });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
}
