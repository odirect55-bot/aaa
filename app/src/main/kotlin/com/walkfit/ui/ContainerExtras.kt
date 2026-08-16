package com.walkfit.ui

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import com.walkfit.WalkFitApplication
import com.walkfit.di.AppContainer

/**
 * Pulls the application's [AppContainer] out of the ViewModel creation extras.
 *
 * This is how every ViewModel in the app is constructed without a DI framework:
 *
 *     val Factory = viewModelFactory { initializer { MyViewModel(walkFitContainer()) } }
 */
internal fun CreationExtras.walkFitContainer(): AppContainer {
    val application = this[ViewModelProvider.AndroidViewModelFactory.APPLICATION_KEY]
    return (application as WalkFitApplication).container
}
