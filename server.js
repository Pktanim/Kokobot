// পেজ চেঞ্জ করার সময় Invite পেজে গেলে সার্ভার থেকে লেটেস্ট ডাটা রিলোড করার কোড
async function showPage(page) {
    ['home', 'task', 'game', 'invite', 'ads', 'wallet'].forEach(name => {
        const el = document.getElementById(name + "Page");
        if (el) el.classList.remove("active");
    });
    const target = document.getElementById(page + "Page");
    if (target) target.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    const nav = document.getElementById("nav" + page.charAt(0).toUpperCase() + page.slice(1));
    if (nav) nav.classList.add("active");

    // যদি কেউ Invite পেজে ক্লিক করে, তবে সাথে সাথে ডাটাবেজ থেকে লেটেস্ট কাউন্ট এনে স্ক্রিন আপডেট করবে
    if (page === 'invite') {
        try {
            const response = await fetch('/api/user/' + telegramId);
            const data = await response.json();
            if (data.success && data.user) {
                referralCount = data.user.referralCount || 0;
                document.getElementById("referralCount").textContent = referralCount;
            }
        } catch (err) {
            console.error("Error refreshing referral count:", err);
        }
    }
}
