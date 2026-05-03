import React from 'react';

export const Card = ({ children, title, action, className = '', style, ...props }) => (
  <div className={`card ${className}`} style={style} {...props}>
    {(title || action) && (
      <div className="card-header">
        {title && <h3 className="card-title">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    {children}
  </div>
);

export const Button = ({ children, variant = 'secondary', className = '', size, ...props }) => {
  const variantClass =
    variant === 'primary' ? 'btn btn-primary' :
    variant === 'ghost'   ? 'btn btn-ghost'   :
                            'btn btn-secondary';
  const sizeClass = size === 'sm' ? 'btn-sm' : '';
  return (
    <button className={`${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Badge = ({ children, variant = 'neutral', className = '', style, ...props }) => {
  const variantClass =
    variant === 'success' ? 'badge badge-success' :
    variant === 'danger'  ? 'badge badge-danger'  :
    variant === 'warning' ? 'badge badge-warning'  :
    variant === 'primary' ? 'badge badge-blue'     :
                            'badge badge-neutral';
  return (
    <span className={`${variantClass} ${className}`} style={style} {...props}>
      {children}
    </span>
  );
};
