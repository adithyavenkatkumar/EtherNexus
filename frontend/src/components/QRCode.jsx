import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

function QRCode({ address }) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        const svg = document.getElementById('qr-code-svg');
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const pngFile = canvas.toDataURL('image/png');

            const downloadLink = document.createElement('a');
            downloadLink.download = `wallet-qr-${address.substring(0, 8)}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    };

    return (
        <>
            <button className="qr-button" onClick={() => setShowModal(true)}>
                📱 Show QR Code
            </button>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowModal(false)}>
                            ✕
                        </button>

                        <h3>Your Wallet QR Code</h3>
                        <p className="modal-subtitle">Scan to receive payments</p>

                        <div className="qr-code-container">
                            <div className="scanning-laser"></div>
                            <QRCodeSVG
                                id="qr-code-svg"
                                value={address}
                                size={256}
                                level="H"
                                includeMargin={true}
                                bgColor="#ffffff"
                                fgColor="#0f172a"
                                imageSettings={{
                                    src: 'https://cdn-icons-png.flaticon.com/512/3064/3064155.png', // Lock icon URL
                                    x: undefined,
                                    y: undefined,
                                    height: 40,
                                    width: 40,
                                    excavate: true,
                                }}
                            />
                        </div>

                        <div className="qr-address">
                            <span className="address-badge" onClick={handleCopy} style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                                {address} 📋
                            </span>
                        </div>

                        <div className="qr-actions">
                            <button className="qr-action-button" onClick={handleCopy}>
                                {copied ? '✓ Copied!' : '📋 Copy Address'}
                            </button>
                            <button className="qr-action-button" onClick={handleDownload}>
                                💾 Download QR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default QRCode;
