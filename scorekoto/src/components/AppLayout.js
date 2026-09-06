import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }) {
    return (
        <>
            <Navbar />

            <div className="page-layout">

                <Sidebar />

                <main className="main-content">
                    {children}
                </main>

            </div>
        </>
    );
}