from typing import Optional
import numpy as np
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.linear_model import LinearRegression


class MeanBaseline(BaseEstimator, RegressorMixin):
    """Predicts mean target value from training data."""
    def __init__(self):
        self.mean_ = 0.0

    def fit(self, X, y):
        self.mean_ = float(np.mean(y))
        return self

    def predict(self, X):
        return np.full(shape=(len(X),), fill_value=self.mean_)


class TheoryBaseline(BaseEstimator, RegressorMixin):
    """
    Predicts ms_per_token = 1000.0 * (x_gpu + x_cpu).
    Assumes pure memory bandwidth limit with 100% efficiency.
    Expects X to have [x_gpu, x_cpu] columns.
    """
    def fit(self, X, y=None):
        return self

    def predict(self, X):
        # X is [x_gpu, x_cpu] in seconds
        return 1000.0 * (X[:, 0] + X[:, 1])


class PhysicsLinear(BaseEstimator, RegressorMixin):
    """
    Fits inference latency as excess over theoretical memory bandwidth floor:
      target = ms_per_token - 1000 * (x_gpu + x_cpu)
      fit target = e0 + e1 * x_gpu + e2 * x_cpu with positive=True
      so coeff_gpu = 1000 + e1 and coeff_cpu = 1000 + e2 (both >= 1000).

    If N_OFFLOAD (configs with offload < 0.95) < 3:
      Fix coeff_cpu = 1000 / 0.6 (60% of theoretical dual-channel RAM bandwidth, a stated prior),
      fit target = e0 + e1 * x_gpu with positive=True,
      and record cpu_term_source = "prior".
    """
    def __init__(self, n_offload_threshold: int = 3, fixed_cpu_eff: float = 0.6):
        self.n_offload_threshold = n_offload_threshold
        self.fixed_cpu_eff = fixed_cpu_eff
        self.coeff_gpu_ = 1000.0
        self.coeff_cpu_ = 1000.0 / fixed_cpu_eff
        self.intercept_ = 0.0
        self.e1_ = 0.0
        self.e2_ = 0.0
        self.cpu_term_source_ = "prior"
        self.n_offload_ = 0

    def fit(self, X, y, f_offload=None):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=float)
        x_gpu = X[:, 0]
        x_cpu = X[:, 1]

        if f_offload is not None:
            f = np.asarray(f_offload, dtype=float)
            self.n_offload_ = int(np.sum(f < 0.95))
        else:
            self.n_offload_ = int(np.sum(x_cpu > 1e-4))

        target = y - 1000.0 * (x_gpu + x_cpu)

        if self.n_offload_ < self.n_offload_threshold:
            self.cpu_term_source_ = "prior"
            self.coeff_cpu_ = 1000.0 / self.fixed_cpu_eff
            self.e2_ = self.coeff_cpu_ - 1000.0

            reg = LinearRegression(fit_intercept=True, positive=True)
            reg.fit(x_gpu.reshape(-1, 1), target)

            self.intercept_ = float(reg.intercept_)
            self.e1_ = float(reg.coef_[0])
            self.coeff_gpu_ = 1000.0 + self.e1_
        else:
            self.cpu_term_source_ = "fitted"
            reg = LinearRegression(fit_intercept=True, positive=True)
            reg.fit(X, target)

            self.intercept_ = float(reg.intercept_)
            self.e1_ = float(reg.coef_[0])
            self.e2_ = float(reg.coef_[1]) if len(reg.coef_) > 1 else 0.0
            self.coeff_gpu_ = 1000.0 + self.e1_
            self.coeff_cpu_ = 1000.0 + self.e2_

        return self

    def predict(self, X):
        X = np.asarray(X, dtype=float)
        x_gpu = X[:, 0]
        x_cpu = X[:, 1]
        pred_ms = self.intercept_ + self.coeff_gpu_ * x_gpu + self.coeff_cpu_ * x_cpu
        return np.maximum(pred_ms, 1.0)
