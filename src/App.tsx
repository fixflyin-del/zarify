import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ShopPage } from './pages/ShopPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage, TrackOrderPage } from './pages/OrderPages';
import { AccountPage, LoginPage, WishlistPage } from './pages/AccountPages';
import { BlogDetailPage, BlogListPage } from './pages/BlogPages';
import { AboutPage, ContactPage, FaqPage, FounderPage, PolicyPage } from './pages/ContentPages';
import { AdminPage } from './pages/AdminPage';

function StorefrontShell({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          {/* Dedicated Secure Admin Panel */}
          <Route path="/admin" element={<AdminPage />} />

          {/* All 24 SEO-Friendly Public Storefront Routes */}
          <Route path="/" element={<StorefrontShell><HomePage /></StorefrontShell>} />
          <Route path="/shop" element={<StorefrontShell><ShopPage /></StorefrontShell>} />
          <Route path="/collections/hijabs" element={<StorefrontShell><ShopPage collectionSlug="hijabs" /></StorefrontShell>} />
          <Route path="/collections/naqaabs" element={<StorefrontShell><ShopPage collectionSlug="naqaabs" /></StorefrontShell>} />
          <Route path="/collections/dupattas" element={<StorefrontShell><ShopPage collectionSlug="dupattas" /></StorefrontShell>} />
          <Route path="/products/:slug" element={<StorefrontShell><ProductDetailPage /></StorefrontShell>} />
          <Route path="/about-us" element={<StorefrontShell><AboutPage /></StorefrontShell>} />
          <Route path="/founder" element={<StorefrontShell><FounderPage /></StorefrontShell>} />
          <Route path="/contact-us" element={<StorefrontShell><ContactPage /></StorefrontShell>} />
          <Route path="/account" element={<StorefrontShell><AccountPage /></StorefrontShell>} />
          <Route path="/login" element={<StorefrontShell><LoginPage /></StorefrontShell>} />
          <Route path="/wishlist" element={<StorefrontShell><WishlistPage /></StorefrontShell>} />
          <Route path="/cart" element={<StorefrontShell><CartPage /></StorefrontShell>} />
          <Route path="/checkout" element={<StorefrontShell><CheckoutPage /></StorefrontShell>} />
          <Route path="/order-confirmation" element={<StorefrontShell><OrderConfirmationPage /></StorefrontShell>} />
          <Route path="/track-order" element={<StorefrontShell><TrackOrderPage /></StorefrontShell>} />
          <Route path="/blog" element={<StorefrontShell><BlogListPage /></StorefrontShell>} />
          <Route path="/blog/:slug" element={<StorefrontShell><BlogDetailPage /></StorefrontShell>} />
          <Route path="/privacy-policy" element={<StorefrontShell><PolicyPage type="privacy" /></StorefrontShell>} />
          <Route path="/terms-and-conditions" element={<StorefrontShell><PolicyPage type="terms" /></StorefrontShell>} />
          <Route path="/shipping-policy" element={<StorefrontShell><PolicyPage type="shipping" /></StorefrontShell>} />
          <Route path="/return-refund-policy" element={<StorefrontShell><PolicyPage type="returns" /></StorefrontShell>} />
          <Route path="/cancellation-policy" element={<StorefrontShell><PolicyPage type="cancellation" /></StorefrontShell>} />
          <Route path="/faq" element={<StorefrontShell><FaqPage /></StorefrontShell>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}
